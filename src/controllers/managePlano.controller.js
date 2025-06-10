// import * as storeBuilderService from '../service/storeBuilder.service.js';
// import * as storeService from '../service/store.service.js';
// import * as planoService from '../service/planogram.service.js';
// import * as storeFixtureService from '../service/storeFixture.service.js';
// import * as fixtureShelfService from '../service/fixtureShelf.service.js';
// import * as planoProductService from '../service/planoProduct.service.js';
// import * as planoVmService from '../service/planoVm.service.js';
// import * as planoMappingService from '../service/planoMapping.service.js';
// import * as planoTaskService from '../service/planoTask.service.js';
// import * as processedTaskService from '../service/processedTaskservice.js';
import * as planoproductCategoryService from '../service/planoproductCategory.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as fixtureLibraryService from '../service/planoLibrary.service.js';
import * as planoTaskService from '../service/planoTask.service.js';
import { logger } from 'tango-app-api-middleware';
import mongoose from 'mongoose';
export async function getplanoFeedback( req, res ) {
  try {
    let query = [];


    query.push( {
      $match: {
        planoId: new mongoose.Types.ObjectId( req.body.planoId ),
        floorId: new mongoose.Types.ObjectId( req.body.floorId ),
        type: 'layout',
      },
    },
    {
      $lookup: {
        from: 'processedtasks',
        let: { 'taskId': '$taskId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$taskId' ] },
                ],
              },
            },
          },
          {
            $project: {
              'userName': 1,
              'createdAt': 1,
              'createdByName': 1,
              'submitTime_string': 1,
            },
          },
        ],
        as: 'taskData',
      },

    }, { $unwind: { path: '$taskData', preserveNullAndEmptyArrays: true } },
    );


    let findPlanoCompliance = await planoTaskService.aggregate( query );

    res.sendSuccess( findPlanoCompliance );
  } catch ( e ) {
    logger.error( { functionName: 'getplanoFeedback', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}
export async function getStoreFixturesfeedback( req, res ) {
  try {
    let query = [];


    query.push( {
      $match: {
        planoId: new mongoose.Types.ObjectId( req.body.planoId ),
        floorId: new mongoose.Types.ObjectId( req.body.floorId ),
        type: { $ne: 'layout' },
      },
    },
    {
      $lookup: {
        from: 'processedtasks',
        let: { 'taskId': '$taskId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$taskId' ] },
                ],
              },
            },
          },
          {
            $project: {
              'userName': 1,
              'createdAt': 1,
              'createdByName': 1,
              'submitTime_string': 1,
            },
          },
        ],
        as: 'taskData',
      },

    }, { $unwind: { path: '$taskData', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'fixtureconfigs',
        let: { 'fixtureId': '$fixtureId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$fixtureId' ] },
                ],
              },
            },
          },
        ],
        as: 'FixtureData',
      },
    },
    {
      $unwind: { path: '$FixtureData', preserveNullAndEmptyArrays: true },
    },
    );


    let findPlanoCompliance = await planoTaskService.aggregate( query );
    console.log( findPlanoCompliance.length );
    res.sendSuccess( { count: findPlanoCompliance.length, data: findPlanoCompliance } );
  } catch ( e ) {
    logger.error( { functionName: 'getplanoFeedbackFixture', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}
export async function updateStorePlano( req, res ) {
  try {
    console.log( 'reached' );
  } catch ( e ) {
    logger.error( { functionName: 'updateStorePlano', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function fixtureList( req, res ) {
  try {
    let findData = await fixtureLibraryService.find( { clientId: req.query.clientId } );
    if ( findData.length === 0 ) {
      return res.sendError( 'nodata found', 204 );
    }
    res.sendSuccess( findData );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureList', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function templateList( req, res ) {
  try {
    let findData = await fixtureConfigService.find( { clientId: req.query.clientId, fixtureLibraryId: new mongoose.Types.ObjectId( req.query.fixtureId ) } );
    if ( findData.length === 0 ) {
      return res.sendError( 'nodata found', 204 );
    }
    res.sendSuccess( findData );
  } catch ( e ) {
    logger.error( { functionName: 'templateList', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function fixtureBrandsList( req, res ) {
  try {
    let findData = await planoproductCategoryService.find( { clientId: req.query.clientId } );
    if ( findData.length === 0 ) {
      return res.sendError( 'nodata found', 204 );
    }
    res.sendSuccess( findData );
  } catch ( e ) {
    logger.error( { functionName: 'templateList', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function updateFixtureStatus( req, res ) {
  try {
    console.log( req.body );

    let comments={
      userId: req.user._id,
      userName: req.user.userName,
      role: req.user.role,
      responsetype: req.user.type,
      comment: req.body.comments,
    };
    console.log( comments );
    // return;
    let updateResponse = await planoTaskService.updateOnefilters(
        { _id: new mongoose.Types.ObjectId( req.body._id ) },
        {
          $set: { 'answers.$[ans].issues.$[iss].Details.$[det].status': 'completed' },
        },
        [
          { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
          { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
          { 'det._id': new mongoose.Types.ObjectId( req.body.DetailsId ) },

        ] );
    let updatecomment = await planoTaskService.updateOnefilters(
        { _id: new mongoose.Types.ObjectId( req.body._id ) },
        {
          $push: { 'answers.$[ans].issues.$[iss].Details.$[det].comments': comments },
        },
        [
          { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
          { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
          { 'det._id': new mongoose.Types.ObjectId( req.body.DetailsId ) },

        ] );
    console.log( updateResponse, updatecomment );
    res.sendSuccess( 'updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateFixtureStatus', error: e } );
    return res.sendError( e, 500 );
  }
}
