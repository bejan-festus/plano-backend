import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as storeBuilderController from '../controllers/storeBuilder.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';

export const storeBuilderRouter = express.Router();

storeBuilderRouter
    .post( '/createStoreLayout', isAllowedSessionHandler, validate( validateDtos.createBuilder ), storeBuilderController.createStoreBuilder )
    .post( '/updateStoreLayout', isAllowedSessionHandler, validate( validateDtos.updateStoreLayout ), storeBuilderController.updateStoreLayout )
    .post( '/storeLayoutList', isAllowedSessionHandler, validate( validateDtos.storeLayoutList ), storeBuilderController.getLayoutList )
    .post( '/updateFloor', isAllowedSessionHandler, validate( validateDtos.updateFloor ), storeBuilderController.updateFloor )
    .post( '/uploadBulkStore', isAllowedSessionHandler, storeBuilderController.uploadBulkStore )
    .post( '/uploadFile', isAllowedSessionHandler, storeBuilderController.uploadFile )
    .post( '/storeList', isAllowedSessionHandler, validate( validateDtos.storeList ), storeBuilderController.storeList )
    .post( '/storeDetails', isAllowedSessionHandler, validate( validateDtos.storeDetails ), storeBuilderController.getStoreDetails )
    .delete( '/deleteStoreLayout:/id', isAllowedSessionHandler, validate( validateDtos.deleteStoreLayout ), storeBuilderController.deleteStoreLayout )
    .post( '/removeFile', isAllowedSessionHandler, storeBuilderController.deleteFile );


