import express from 'express';
import * as managePlanoController from '../controllers/managePlano.controller.js';


export const managePlanoRouter = express.Router();

managePlanoRouter
    .post( '/updateStorePlano', managePlanoController.updateStorePlano );
