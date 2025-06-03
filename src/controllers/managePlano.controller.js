// import * as storeBuilderService from '../service/storeBuilder.service.js';
// import * as storeService from '../service/store.service.js';
// import * as planoService from '../service/planogram.service.js';
// import * as storeFixtureService from '../service/storeFixture.service.js';
// import * as fixtureShelfService from '../service/fixtureShelf.service.js';
// import * as planoProductService from '../service/planoProduct.service.js';
// import * as planoVmService from '../service/planoVm.service.js';
// import * as planoMappingService from '../service/planoMapping.service.js';
// import * as planoTaskService from '../service/planoTask.service.js';
// import * as processedTaskService from '../service/processedTaskservice.js';
// import * as fixtureConfigService from '../service/fixtureConfig.service.js';
// import * as fixtureLibraryService from '../service/planoLibrary.service.js';

export async function updateStorePlano( req, res ) {
  try {
    console.log( 'reached' );
  } catch ( e ) {
    logger.error( { functionName: 'updateStorePlano', error: e } );
    return res.sendError( e, 500 );
  }
}
