import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as fixtureTemplateController from '../controllers/fixtureTemplatecontroller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const fixtureTemplateRouter = express.Router();

fixtureTemplateRouter
    .post( '/createTemplate', isAllowedSessionHandler, validate( validateDtos.createTemplate ), fixtureTemplateController.createTemplate )
    .post( '/updateTemplate', isAllowedSessionHandler, validate( validateDtos.queryTemplateId ), fixtureTemplateController.updateTemplate )
    .post( '/deleteTemplate', isAllowedSessionHandler, validate( validateDtos.templateId ), fixtureTemplateController.deleteTemplate )
    .post( '/duplicateTemplate', isAllowedSessionHandler, validate( validateDtos.templateId ), fixtureTemplateController.duplicateTemplate )
    .post( '/getTemplateList', isAllowedSessionHandler, validate( validateDtos.fixtureVMListSchema ), fixtureTemplateController.getTemplateList )
    .get( '/getTemplateDetails', isAllowedSessionHandler, validate( validateDtos.queryTemplateId ), fixtureTemplateController.getTemplateDetails );

