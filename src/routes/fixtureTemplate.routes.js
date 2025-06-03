import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as fixtureTemplateController from '../controllers/fixtureTemplate.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const fixtureTemplateRouter = express.Router();

fixtureTemplateRouter
    .post( '/createTemplate', validate( validateDtos.createTemplate ), fixtureTemplateController.createTemplate )
    .post( '/updateTemplate/:templateId', fixtureTemplateController.updateTemplate )
    .post( '/deleteTemplate', validate( validateDtos.templateId ), fixtureTemplateController.deleteTemplate )
    .post( '/duplicateTemplate', validate( validateDtos.templateId ), fixtureTemplateController.duplicateTemplate )
    .post( '/getTemplateList', validate( validateDtos.fixtureVMListSchema ), fixtureTemplateController.getTemplateList )
    .get( '/getTemplateDetails', validate( validateDtos.queryTemplateId ), fixtureTemplateController.getTemplateDetails )
    .post( '/updateFixtureTask', validate( validateDtos.updateFixtureTask ), fixtureTemplateController.updateFixtureTask );

