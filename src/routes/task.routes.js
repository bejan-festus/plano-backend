import express from 'express';
// import { isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as taskController from '../controllers/task.controller.js';

export const taskRouter = express.Router();

taskRouter
    .post( '/createTask', taskController.createTask )
    .get( '/taskDetails', taskController.getTaskDetails )
    .post( '/uploadImage', taskController.uploadImage )
    .post( '/updateStatus', taskController.updateStatus )
    .post( '/updateAnswers', taskController.updateAnswers );
