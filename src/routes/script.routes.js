import express from 'express';

export const scriptRouter = express.Router();
import * as scriptController from '../controllers/script.controller.js';


scriptRouter
    .post( '/getUniqueStoresFromExcel', scriptController.getStoreNames )
    .post( '/bilkInsertFixtureConfig', scriptController.createFixtureConfig )
    .post( '/bulkInsertPlanoData', scriptController.createPlano )
    .post( '/bulkIinsertFloorData', scriptController.createFloors )
    .post( '/bulkIinsertVmTemplateData', scriptController.createVmData )
    .post( '/bulkIinsertFixturesShelvesVmsData', scriptController.createFixturesShelves )
    .post( '/updateFixturesShelvesVms', scriptController.updateFixturesShelves )
    .post( '/lk98lK1993Update', scriptController.lk98lK1993Update )
    .post( '/updateinventory', scriptController.updateInventory )
    .post( '/updateRfidProduct', scriptController.updateRfidProduct )
    .post( '/updateRfidProduct2', scriptController.updateRfidProduct2 )
    .post( '/getProdTaskData', scriptController.getProdTaskData )
    .post( '/updateLayoutFeedback', scriptController.updatelayoutFeedback )
    .post( '/updateFixtureFeedback', scriptController.updateFixtureFeedback )
    .post( '/getFileNames', scriptController.extractZipFileNames )
    .post( '/getVmTaskData', scriptController.getVmTaskData )
    .post( '/updateVmData', scriptController.updateVmData )
    .post( '/createCrestPlanogram', scriptController.createCrestPlanogram )
    .post( '/updateCrestPlanogram', scriptController.updateCrestPlanogram )
    .post( '/updatelayout', scriptController.updatelayout )
    .post( '/updateCrestVms', scriptController.updateCrestVms )
    .post( '/downloadPlanoImages', scriptController.downloadPlanoImage )
    .post( '/getVideoUrls', scriptController.getVideoLinks )
    .post( '/updateExcelPlanogram', scriptController.updateExcelPlanogram )
    .post( '/recorrectTaskData', scriptController.recorrectTaskData )
    .post( '/migrateCrest', scriptController.migrateCrest )
;
