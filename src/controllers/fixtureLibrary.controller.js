import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import { logger } from 'tango-app-api-middleware';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as planoProductService from '../service/planoProduct.service.js';
import * as planoMappingService from '../service/planoMapping.service.js';
import * as planoComplianceService from '../service/planoCompliance.service.js';
import * as planoTaskComplianceService from '../service/planoTask.service.js';
import * as planoQrConversionRequestService from '../service/planoQrConversionRequest.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as planoStaticData from '../service/planoStaticData.service.js';


export async function sample( req, res ) {
  try {

  } catch ( e ) {
    logger.error( { functionName: 'sample', error: e } );
    return res.sendError( e, 500 );
  }
}
