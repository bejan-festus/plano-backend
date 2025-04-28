import express from 'express';
import { validate, isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as fixtureTemplateController from '../controllers/fixtureLibrary.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const fixtureTemplateRouter = express.Router();

fixtureTemplateRouter
    .post( '/sample', isAllowedSessionHandler, validate( validateDtos.createBuilder ), fixtureTemplateController.sample );
