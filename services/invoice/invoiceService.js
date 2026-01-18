const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { getInvoiceSettings } = require('../../database');
const { businessLogger: logger } = require('../../utils/logger');

// Google 認證
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../../credentials/service-account.json'),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});

class InvoiceService {
  constructor() {
    this.drive = google.drive({ version: 'v3', auth });
    this.tempDir = path.join(__dirname, '../../temp');
    
    // 確保臨時目錄存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 生成發票編號
   * @param {string} prefix - 發票前綴
   * @returns {string} 發票編號
   */
  generateInvoiceNumber(prefix = 'INV') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${year}${month}${random}`;
  }

  /**
   * 生成發票 PDF
   * @param {Object} data - 發票數據
   * @returns {Promise<string>} 臨時 PDF 文件路徑
   */
  async generatePDF(data) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    const tempPath = path.join(this.tempDir, `invoice-${Date.now()}.pdf`);
    const writeStream = fs.createWriteStream(tempPath);

    return new Promise((resolve, reject) => {
      doc.pipe(writeStream);

      // 添加發票內容
      this.addInvoiceContent(doc, data);

      writeStream.on('finish', () => resolve(tempPath));
      writeStream.on('error', reject);
      doc.end();
    });
  }

  /**
   * 添加發票內容到 PDF
   * @param {PDFDocument} doc - PDF 文檔對象
   * @param {Object} data - 發票數據
   */
  addInvoiceContent(doc, data) {
    // 標題
    doc.fontSize(20).text('發票/收據', { align: 'center' });
    doc.moveDown();

    // 發票信息
    doc.fontSize(12);
    doc.text(`發票編號：${data.invoiceNumber}`);
    doc.text(`日期：${data.date}`);
    doc.text(`金額：${data.amount}`);
    doc.moveDown();

    // 詳細信息
    doc.text(`描述：${data.description}`);
    doc.moveDown();

    // 如果有圖片，添加圖片
    if (data.imageUrl) {
      doc.image(data.imageUrl, {
        fit: [500, 300],
        align: 'center'
      });
    }

    // 添加頁腳
    doc.fontSize(10);
    doc.text('此發票由系統自動生成', { align: 'center' });
  }

  /**
   * 上傳發票到 Google Drive
   * @param {string} pdfPath - PDF 文件路徑
   * @param {string} folderId - Google Drive 文件夾 ID
   * @returns {Promise<string>} 文件網址
   */
  async uploadToDrive(pdfPath, folderId) {
    try {
      const fileMetadata = {
        name: `發票_${Date.now()}.pdf`,
        parents: [folderId]
      };

      const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(pdfPath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      // 設置文件權限
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      return response.data.webViewLink;
    } catch (error) {
      logger.error(`上傳發票到 Drive 失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 清理臨時文件
   * @param {string} filePath - 文件路徑
   */
  cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(`清理臨時文件失敗: ${error.message}`);
    }
  }

  /**
   * 生成並上傳發票
   * @param {Object} data - 發票數據
   * @param {string} folderId - Google Drive 文件夾 ID
   * @returns {Promise<string>} 發票網址
   */
  async generateAndUploadInvoice(data, folderId) {
    let tempPdfPath = null;
    try {
      // 生成發票編號
      data.invoiceNumber = this.generateInvoiceNumber();
      
      // 生成 PDF
      tempPdfPath = await this.generatePDF(data);
      
      // 上傳到 Drive
      const fileUrl = await this.uploadToDrive(tempPdfPath, folderId);
      
      return fileUrl;
    } catch (error) {
      logger.error(`生成並上傳發票失敗: ${error.message}`);
      throw error;
    } finally {
      // 清理臨時文件
      if (tempPdfPath) {
        this.cleanupTempFile(tempPdfPath);
      }
    }
  }

  /**
   * 檢查用戶是否啟用了發票功能
   * @param {string} userId - 用戶 ID
   * @returns {Promise<boolean>} 是否啟用
   */
  async isEnabled(userId) {
    try {
      const settings = await getInvoiceSettings(userId);
      return settings.invoice_enabled === 1 && !!settings.invoice_folder_id;
    } catch (error) {
      logger.error(`檢查發票設置失敗: ${error.message}`);
      return false;
    }
  }

  /**
   * 生成並上傳發票（帶設置檢查）
   * @param {Object} data - 發票數據
   * @param {string} userId - 用戶 ID
   * @returns {Promise<string|null>} 發票網址，如果未啟用則返回 null
   */
  async generateAndUploadInvoiceWithCheck(data, userId) {
    try {
      // 檢查是否啟用
      if (!await this.isEnabled(userId)) {
        logger.info(`用戶 ${userId} 未啟用發票功能`);
        return null;
      }

      // 獲取設置
      const settings = await getInvoiceSettings(userId);
      
      // 生成並上傳發票
      return await this.generateAndUploadInvoice(data, settings.invoice_folder_id);
    } catch (error) {
      logger.error(`生成並上傳發票失敗: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new InvoiceService(); 