import * as floorService from '../service/storeBuilder.service.js';
import { logger } from 'tango-app-api-middleware';
// import * as storeService from '../service/store.service.js';
// import * as planoService from '../service/planogram.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
// import * as planoProductService from '../service/planoProduct.service.js';
// import * as planoVmService from '../service/planoVm.service.js';
// import * as planoMappingService from '../service/planoMapping.service.js';
// import * as planoTaskService from '../service/planoTask.service.js';
// import * as processedTaskService from '../service/processedTaskservice.js';
import * as planoproductCategoryService from '../service/planoproductCategory.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as fixtureLibraryService from '../service/planoLibrary.service.js';
import * as planoTaskService from '../service/planoTask.service.js';
import mongoose from 'mongoose';
export async function getplanoFeedback( req, res ) {
  try {
    let query = [];


    query.push( {
      $match: {
        planoId: new mongoose.Types.ObjectId( req.body.planoId ),
        floorId: new mongoose.Types.ObjectId( req.body.floorId ),
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
    console.log( findPlanoCompliance );
    res.sendSuccess( findPlanoCompliance );
  } catch ( e ) {
    logger.error( { functionName: 'getplanoFeedback', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}
export async function updateStorePlano( req, res ) {
  try {
    const { floorId, data } = req.body;

    const floorData = await floorService.findOne( { _id: new mongoose.Types.ObjectId( floorId ) } );

    const additionalMeta = {
      clientId: '11',
      storeId: floorData.toObject().storeId,
      storeName: floorData.toObject().storeName,
      planoId: floorData.toObject().planoId,
      floorId: floorData.toObject()._id,
    };

    const layoutPolygon = JSON.parse( JSON.stringify( data.layoutPolygon ) );

    layoutPolygon.forEach( ( element ) => {
      delete element.fixtures;
    } );

    await floorService.updateOne( { _id: new mongoose.Types.ObjectId( floorId ) },
        { layoutPolygon: layoutPolygon } );

    const currentWallFixtures = data.layoutPolygon.flatMap( ( element ) =>
      ( element.fixtures || [] ).map( ( fixture ) => fixture ),
    );

    const currentFloorFixtures = ( data.centerFixture || [] );

    const currentFixtures = [ ...currentWallFixtures, ...currentFloorFixtures ];

    const existingFixtures = await storeFixtureService.find( { floorId: new mongoose.Types.ObjectId( floorId ) } );

    const currentIds = new Set( currentFixtures.map( ( f ) => f._id ) );
    const removedFixtures = existingFixtures.filter(
        ( f ) => f._id && !currentIds.has( f._id.toString() ),
    );

    if ( removedFixtures.length ) {
      const fixtureIds = removedFixtures.map( ( fixture ) => fixture.toObject()._id );
      await storeFixtureService.deleteMany( { _id: { $in: fixtureIds } } );
      await fixtureShelfService.deleteMany( { fixtureId: { $in: fixtureIds } } );
    }


    const newWallFixtures = currentWallFixtures.filter( ( fixture ) => fixture?._id?.startsWith( 'new' ) );

    const newFloorFixtures = currentFloorFixtures.filter( ( fixture ) => fixture?._id?.startsWith( 'new' ) );

    const newFixtures = [ ...newWallFixtures, ...newFloorFixtures ];

    if ( newFixtures.length ) {
      newFixtures.forEach( async ( fixture ) => {
        delete fixture._id;
        const fixturePayload = {
          ...additionalMeta,
          ...fixture,
        };
        const createdFixture = await storeFixtureService.create( fixturePayload );
        fixture.shelfConfig.forEach( async ( shelf ) => {
          delete shelf._id;
          const shelfPayload = {
            ...additionalMeta,
            ...shelf,
            fixtureId: createdFixture.toObject()._id,

          };
          await fixtureShelfService.create( shelfPayload );
        } );
      } );
    }

    currentFixtures.forEach( async ( fixture ) => {
      if ( mongoose.Types.ObjectId.isValid( fixture._id ) ) {
        const updatedFixture = await storeFixtureService.upsertOne( { _id: new mongoose.Types.ObjectId( fixture._id ) }, fixture );

        await fixtureShelfService.deleteMany( { fixtureId: new mongoose.Types.ObjectId( fixture._id ) } );

        fixture.shelfConfig.forEach( async ( shelf ) => {
          delete shelf._id;
          const shelfPayload = {
            ...additionalMeta,
            ...shelf,
            fixtureId: updatedFixture.toObject()._id,
          };
          await fixtureShelfService.create( shelfPayload );
        } );
      }
    } );

    res.sendSuccess( 'Updated Successfully' );
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
