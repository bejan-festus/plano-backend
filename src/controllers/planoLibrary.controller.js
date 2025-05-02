import { logger } from 'tango-app-api-middleware';
import * as planoLibraryService from '../service/planoLibrary.service.js';
import xlsx from 'xlsx';


export async function fixtureBulkUpload( req, res ) {
  try {
    if ( !req?.files?.file ) {
      return res.sendError( 'Please upload a file', 400 );
    }
    const workbook = xlsx.read( req?.files?.file, { type: 'buffer' } );
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json( worksheet );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'fixtureBulkUpload', error: e } );
    return res.sendError( e, 500 );
  }
}
