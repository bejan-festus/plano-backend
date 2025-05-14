import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as planoLibraryController from '../controllers/planoLibrary.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const planoLibraryRouter = express.Router();

planoLibraryRouter
    .post( '/fixtureBulkUpload', isAllowedSessionHandler, planoLibraryController.fixtureBulkUpload )
    .post( '/createFixture', isAllowedSessionHandler, validate( validateDtos.createFixture ), planoLibraryController.createFixture )
    .post( '/updateFixture/:fixtureId', isAllowedSessionHandler, validate( validateDtos.updateFixture ), planoLibraryController.updateFixture )
    .get( '/fixtureDetails/:fixtureId', isAllowedSessionHandler, planoLibraryController.getFixture )
    .post( '/fixtureList', isAllowedSessionHandler, validate( validateDtos.fixtureList ), planoLibraryController.FixtureLibraryList )
    .post( '/duplicateFixture', isAllowedSessionHandler, planoLibraryController.duplicateFixture )
    .post( '/deleteFixture', isAllowedSessionHandler, planoLibraryController.deleteFixture )
    .get( '/librarySizeList', isAllowedSessionHandler, planoLibraryController.getFixLibWidth );

planoLibraryRouter
    .post( '/addVmType', isAllowedSessionHandler, validate( validateDtos.addVmType ), planoLibraryController.addVmType )
    .post( '/updateVmType/:id', isAllowedSessionHandler, planoLibraryController.updateVmImage )
    .get( '/getVmTypeList', isAllowedSessionHandler, planoLibraryController.getVmTypeList )
    .post( '/deletevmImage', isAllowedSessionHandler, planoLibraryController.deleteVmImage )
    .post( '/deletevmType', isAllowedSessionHandler, planoLibraryController.deleteVmType );

planoLibraryRouter
    .get( '/getBrandList', isAllowedSessionHandler, planoLibraryController.getBrandList )
    .post( '/addUpdateBrand', isAllowedSessionHandler, planoLibraryController.addUpdateBrandList )
    .post( '/uploadBrandList', isAllowedSessionHandler, planoLibraryController.uploadBrandList )
    .post( '/taskconfig', isAllowedSessionHandler, planoLibraryController.updateTaskConfig );

planoLibraryRouter
    .post( '/addUpdateVm', isAllowedSessionHandler, planoLibraryController.addUpdateVm )
    .post( '/getVmLibList', isAllowedSessionHandler, planoLibraryController.getVmLibList )
    .post( '/duplicateVmLib', isAllowedSessionHandler, planoLibraryController.duplicateVmLib )
    .post( '/deleteVmLib', isAllowedSessionHandler, planoLibraryController.deleteVmLibrary )
    .get( '/getVmDetails', isAllowedSessionHandler, planoLibraryController.getVmDetails );

