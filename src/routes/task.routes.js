import express from 'express';
import { isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as taskController from '../controllers/task.controller.js';

export const storeBuilderTaskRouter = express.Router();

storeBuilderTaskRouter
    .post( '/createTask', isAllowedSessionHandler, taskController.createTask )
    .post( '/createPlano', isAllowedSessionHandler, taskController.createPlano )
    .get( '/taskDetails', isAllowedSessionHandler, taskController.getTaskDetails )
    .post( '/uploadImage', isAllowedSessionHandler, taskController.uploadImage )
    .post( '/updateStatus', isAllowedSessionHandler, taskController.updateStatus )
    .post( '/updateAnswers', isAllowedSessionHandler, taskController.updateAnswers )
    .post( '/updateAnswersv2', isAllowedSessionHandler, taskController.updateAnswersv2 )
    .get( '/getFixtureDetails', isAllowedSessionHandler, taskController.getFixtureDetails )
    .get( '/getVmDetails', isAllowedSessionHandler, taskController.getVmDetails )
    .post( '/generateTaskExcel', taskController.generatetaskDetails )
    .post( '/getSubmitDetails', taskController.taskSubmitDetails )
    .post( '/redoTask', isAllowedSessionHandler, taskController.redoTask );
