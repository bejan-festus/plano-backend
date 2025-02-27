import express from 'express';

export const scriptRouter = express.Router();
import * as scriptController from '../controllers/script.controller.js';


scriptRouter
    .post( '/getUniqueStoresFromExcel', scriptController.getStoreNames )
    .post( '/bilkInsertFixtureConfig', scriptController.createFixtureConfig )
    .post( '/bulkInsertPlanoData', scriptController.createPlano )
    .post( '/bulkIinsertFloorData', scriptController.createFloors )
    .post( '/bulkIinsertVmTemplateData', scriptController.createVmData )
    .post( '/bulkIinsertFixturesShelvesVmsData', scriptController.createFixturesShelves );
