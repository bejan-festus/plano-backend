import express from 'express';
import { validate, isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as storeBuilderController from '../controllers/storeBuilder.controller.js';
// import * as scriptController from '../controllers/script.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const storeBuilderRouter = express.Router();

storeBuilderRouter
    .post( '/createStoreLayout', isAllowedSessionHandler, validate( validateDtos.createBuilder ), storeBuilderController.createStoreBuilder )
    .post( '/updateStoreLayout', isAllowedSessionHandler, validate( validateDtos.updateStoreLayout ), storeBuilderController.updateStoreLayout )
    .post( '/storeLayoutList', validate( validateDtos.storeLayoutList ), storeBuilderController.getLayoutList )
    .post( '/updateFloor', isAllowedSessionHandler, validate( validateDtos.updateFloor ), storeBuilderController.updateFloor )
    .post( '/uploadBulkStore', isAllowedSessionHandler, storeBuilderController.uploadBulkStore )
    .post( '/uploadFile', isAllowedSessionHandler, storeBuilderController.uploadFile )
    // .post( '/storeLayout', validate( validateDtos.storeList ), storeBuilderController.storeFixtures )
    .post( '/storeDetails', isAllowedSessionHandler, validate( validateDtos.storeDetails ), storeBuilderController.getStoreDetails )
    .delete( '/deleteStoreLayout/:id', isAllowedSessionHandler, validate( validateDtos.deleteStoreLayout ), storeBuilderController.deleteStoreLayout )
    .post( '/removeFile', isAllowedSessionHandler, storeBuilderController.deleteFile )
    .post( '/deleteFloor', isAllowedSessionHandler, storeBuilderController.deleteFloor )
    .post( '/updateStatus', isAllowedSessionHandler, validate( validateDtos.updateStatus ), storeBuilderController.updateStatus )
    // .post( '/FixtureShelfDetails', storeBuilderController.fixtureShelfProduct )
    // .post( '/scan', storeBuilderController.scan )
    .post( '/storeLayout', isAllowedSessionHandler, validate( validateDtos.storeList ), storeBuilderController.storeLayout )
    .post( '/storeFixtures', validate( validateDtos.storeList ), storeBuilderController.storeFixturesv1 )
    .post( '/FixtureShelfDetails', validate( validateDtos.fixtureShelfProduct ), storeBuilderController.fixtureShelfProductv1 )
    .post( '/scan', isAllowedSessionHandler, storeBuilderController.scanv1 )
    .post( '/updateMissing', isAllowedSessionHandler, storeBuilderController.updateMissing )
    .post( '/bulkFixtureUpload', isAllowedSessionHandler, storeBuilderController.bulkFixtureUpload )
    .post( '/uploadImage', isAllowedSessionHandler, storeBuilderController.uploadImage )
    .post( '/storeFixturesTask', isAllowedSessionHandler, storeBuilderController.storeFixturesTask )
    .post( '/qrFileUpload', isAllowedSessionHandler, storeBuilderController.qrFileUpload )
    .post( '/updateQrCvProcessRequest', isAllowedSessionHandler, storeBuilderController.updateQrCvProcessRequest )
    .post( '/getQrCvProcessRequest', isAllowedSessionHandler, storeBuilderController.getQrCvProcessRequest )
    .post( '/fixtureQrUpdate', isAllowedSessionHandler, storeBuilderController.fixtureQrUpdate )
    .post( '/fixtureQrUpdatev1', isAllowedSessionHandler, storeBuilderController.fixtureQrUpdatev1 )
    .post( '/updateDeatailedDistance', isAllowedSessionHandler, storeBuilderController.updateDetailedDistance )
    .post( '/upsertFixture', isAllowedSessionHandler, storeBuilderController.upsertFixtures )
    .post( '/getshelfSections', isAllowedSessionHandler, storeBuilderController.getShelfSections )
    .post( '/getFixtureTypes', isAllowedSessionHandler, storeBuilderController.getFixtureTypes )
    .post( '/getFixtureLengths', isAllowedSessionHandler, storeBuilderController.getFixtureLengths )
    .post( '/getFixtureBrands', isAllowedSessionHandler, storeBuilderController.getFixtureBrands )
    .post( '/checkPlanoExist', storeBuilderController.checkPlanoExist )
    .post( '/storeLayoutElements', isAllowedSessionHandler, storeBuilderController.storeLayoutElements );
