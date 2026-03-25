import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const documentService = {
  /**
   * Lee un archivo según su extensión y extrae su texto.
   * Modos soportados: .txt, .pdf, .docx, .xlsx, .csv
   */
  async extractText(filePath: string, originalName: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    
    try {
      if (ext === '.txt' || ext === '.csv' || ext === '.md' || ext === '.json') {
        // Texto plano directo
        return fs.readFileSync(filePath, 'utf-8');
      } 
      
      else if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } 
      
      else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } 
      
      else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = xlsx.readFile(filePath);
        let allText = '';
        
        // Iterar sobre todas las hojas
        for (const sheetName of workbook.SheetNames) {
          allText += `\n--- Hoja: ${sheetName} ---\n`;
          const worksheet = workbook.Sheets[sheetName];
          // Convertir la hoja a CSV (texto plano separado por comas)
          allText += xlsx.utils.sheet_to_csv(worksheet);
        }
        return allText;
      } 
      
      else {
        throw new Error(`Formato de archivo no soportado actualmente: ${ext}`);
      }
    } catch (error) {
      console.error(`Error extrayendo texto del archivo ${originalName}:`, error);
      throw new Error(`No pude leer el contenido del archivo ${originalName}.`);
    }
  }
};
