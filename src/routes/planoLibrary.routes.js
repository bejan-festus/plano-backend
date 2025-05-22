import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as planoLibraryController from '../controllers/planoLibrary.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const planoLibraryRouter = express.Router();

planoLibraryRouter
    .post( '/fixtureBulkUpload', isAllowedSessionHandler, validate( validateDtos.fixtureBulkUpload ), planoLibraryController.fixtureBulkUpload )
    .post( '/createFixture', isAllowedSessionHandler, validate( validateDtos.createFixture ), planoLibraryController.createFixture )
    .post( '/updateFixture/:fixtureId', isAllowedSessionHandler, validate( validateDtos.updateFixture ), planoLibraryController.updateFixture )
    .get( '/fixtureDetails', isAllowedSessionHandler, validate( validateDtos.fixtureId ), planoLibraryController.getFixture )
    .post( '/fixtureList', isAllowedSessionHandler, validate( validateDtos.fixtureVMListSchema ), planoLibraryController.FixtureLibraryList )
    .post( '/duplicateFixture', isAllowedSessionHandler, validate( validateDtos.bodyFixtureId ), planoLibraryController.duplicateFixture )
    .post( '/deleteFixture', isAllowedSessionHandler, validate( validateDtos.bodyFixtureId ), planoLibraryController.deleteFixture )
    .get( '/fixtureSizeList', isAllowedSessionHandler, validate( validateDtos.getClient ), planoLibraryController.getFixLibWidth );

planoLibraryRouter
    .post( '/addVmType', isAllowedSessionHandler, validate( validateDtos.addVmType ), planoLibraryController.addVmType )
    .post( '/uploadVmtypeImage/:vmId', isAllowedSessionHandler, planoLibraryController.uploadVmImage )
    .post( '/deleteVmType', isAllowedSessionHandler, planoLibraryController.deleteVmType )
    .get( '/getVmTypeList', isAllowedSessionHandler, validate( validateDtos.getClient ), planoLibraryController.getVmTypeList )
    .post( '/deleteVmTypeImage', isAllowedSessionHandler, validate( validateDtos.deleteVMTypeImage ), planoLibraryController.deletevmTypeImage );

planoLibraryRouter
    .get( '/getBrandList', isAllowedSessionHandler, validate( validateDtos.getClient ), planoLibraryController.getBrandList )
    .post( '/addUpdateBrand', isAllowedSessionHandler, validate( validateDtos.addUpdateBrand ), planoLibraryController.addUpdateBrandList )
    .post( '/uploadBrandList', isAllowedSessionHandler, validate( validateDtos.uploadBrandList ), planoLibraryController.uploadBrandList )
    .post( '/updateTaskconfig', isAllowedSessionHandler, validate( validateDtos.updateTaskConfig ), planoLibraryController.updateTaskConfig )
    .get( '/getTaskConfig', isAllowedSessionHandler, validate( validateDtos.getClient ), planoLibraryController.getTaskConfig );

planoLibraryRouter
    .post( '/addUpdateVm', isAllowedSessionHandler, validate( validateDtos.addUpdateVm ), planoLibraryController.addUpdateVm )
    .post( '/getVmLibList', isAllowedSessionHandler, validate( validateDtos.fixtureVMListSchema ), planoLibraryController.getVmLibList )
    .post( '/duplicateVmLib', isAllowedSessionHandler, validate( validateDtos.deleteVmLib ), planoLibraryController.duplicateVmLib )
    .post( '/deleteVmLib', isAllowedSessionHandler, validate( validateDtos.deleteVmLib ), planoLibraryController.deleteVmLibrary )
    .get( '/getVmDetails', isAllowedSessionHandler, validate( validateDtos.getVmDetails ), planoLibraryController.getVmDetails )
    .post( '/vmBulkUpload', isAllowedSessionHandler, validate( validateDtos.vmBulkUpload ), planoLibraryController.vmBulkUpload );

