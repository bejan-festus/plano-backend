import express from 'express';
import * as managePlanoController from '../controllers/managePlano.controller.js';


export const managePlanoRouter = express.Router();

managePlanoRouter
    .post( '/updateStorePlano', managePlanoController.updateStorePlano )
    .post( '/getplanoFeedback', managePlanoController.getplanoFeedback )
    .get( '/fixtureList', managePlanoController.fixtureList )
    .get( '/templateList', managePlanoController.templateList )
    .get( '/fixtureBrandsList', managePlanoController.fixtureBrandsList );
