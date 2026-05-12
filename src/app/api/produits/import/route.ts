import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write file to a temporary location
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `upload_${Date.now()}.pdf`);
    await fs.writeFile(tempFilePath, buffer);

    // Create a temporary python script to extract text via pdfplumber
    const pythonScriptPath = path.join(tempDir, `parse_pdf_${Date.now()}.py`);
    const pythonCode = `
import pdfplumber
import sys

# Windows utf-8 fallback
sys.stdout.reconfigure(encoding='utf-8')

def main():
    pdf_path = sys.argv[1]
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\\n"
        print(text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
`;
    await fs.writeFile(pythonScriptPath, pythonCode);

    // Run the python script using the local virtual env where we installed pdfplumber
    // Fallback to global python if venv python doesn't exist
    const pythonExe = path.resolve(process.cwd(), 'venv', 'Scripts', 'python.exe');
    const cmd = `"${pythonExe}" "${pythonScriptPath}" "${tempFilePath}"`;
    
    const { stdout, stderr } = await execAsync(cmd);
    
    // Clean up temporary files
    await fs.unlink(tempFilePath).catch(() => {});
    await fs.unlink(pythonScriptPath).catch(() => {});

    if (stderr && !stdout) {
      throw new Error(`Erreur Python: ${stderr}`);
    }

    const text = stdout;

    const lines = text.split('\n');
    const productsToInsert = [];

    const regex = /^([A-Za-z0-9]+)\s+(.+?)\s+(\d{1,4},\d{2})\s*(KG|ST|UNIT|PC)?$/i;

    for (const line of lines) {
      const match = line.trim().match(regex);
      if (match) {
        const reference_code = match[1];
        let name = match[2].trim();
        const priceString = match[3].replace(',', '.');
        const base_price = parseFloat(priceString);
        
        const unit = match[4] ? match[4].trim() : '';
        if (unit && unit !== 'KG') {
           name += ` (${unit})`;
        }

        productsToInsert.push({
          reference_code,
          name,
          base_price,
          stock_quantity: 100
        });
      }
    }

    if (productsToInsert.length === 0) {
       return NextResponse.json({ error: 'Aucun produit reconnu dans le PDF. Réessayez ou vérifiez votre PDF.' }, { status: 400 });
    }

    // Insert into Supabase
    const { data: upsertedData, error } = await supabaseAdmin
      .from('products')
      .upsert(productsToInsert, { onConflict: 'reference_code' })
      .select();

    if (error) {
       throw error;
    }

    return NextResponse.json({ 
      success: true, 
      count: productsToInsert.length,
      sample: productsToInsert.slice(0, 3) 
    });

  } catch (error: any) {
    console.error('Erreur importation PDF:', error);
    return NextResponse.json({ error: error.message || 'Erreur inconnue' }, { status: 500 });
  }
}
