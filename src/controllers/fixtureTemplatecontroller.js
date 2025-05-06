import { logger } from 'tango-app-api-middleware';


export async function sample( req, res ) {
  try {
    if ( !req?.files?.file ) {
      return res.sendError( 'Please upload a file', 400 );
    }
  } catch ( e ) {
    logger.error( { functionName: 'fixtureBulkUpload', error: e } );
    return res.sendError( e, 500 );
  }
}
