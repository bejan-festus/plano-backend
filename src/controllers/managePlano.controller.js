import * as floorService from '../service/storeBuilder.service.js';
import { logger } from 'tango-app-api-middleware';
// import * as storeService from '../service/store.service.js';
// import * as planoService from '../service/planogram.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
// import * as planoProductService from '../service/planoProduct.service.js';
import * as planoVmService from '../service/planoVm.service.js';
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
    { $sort: { _id: -1 } },
    );


    let findPlanoCompliance = await planoTaskService.aggregate( query );
    let queryfixture = [];


    queryfixture.push( {
      $match: {
        planoId: new mongoose.Types.ObjectId( req.body.planoId ),
        floorId: new mongoose.Types.ObjectId( req.body.floorId ),
        type: 'fixture',
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
        from: 'storefixtures',
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
        as: 'storeFixtureData',
      },
    },
    {
      $unwind: { path: '$storeFixtureData', preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: 'fixtureconfigs',
        let: { 'fixtureConfigId': '$storeFixtureData.fixtureConfigId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$fixtureConfigId' ] },
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


    let findfixtureCompliance = await planoTaskService.aggregate( queryfixture );
    let queryVm = [];


    queryVm.push( {
      $match: {
        planoId: new mongoose.Types.ObjectId( req.body.planoId ),
        floorId: new mongoose.Types.ObjectId( req.body.floorId ),
        type: 'vm',
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
        from: 'storefixtures',
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
        as: 'storeFixtureData',
      },
    },
    {
      $unwind: { path: '$storeFixtureData', preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: 'fixtureconfigs',
        let: { 'fixtureConfigId': '$storeFixtureData.fixtureConfigId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$fixtureConfigId' ] },
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
    {
      $unwind: { path: '$FixtureData.vmConfig', preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: 'planovmdetails',
        let: { 'vmId': '$FixtureData.vmConfig.vmId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [ '$_id', '$$vmId' ] },
                ],
              },
            },
          },
          {
            $project: {
              vmName: 1,
            },
          },
        ],
        as: 'vmDetails',
      },
    },
    {
      $unwind: { path: '$vmDetails', preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        '_id': 1,
        'answers': 1,
        'createdAt': 1,
        'date_iso': 1,
        'date_string': 1,
        'fixtureId': 1,
        'floorId': 1,
        'planoId': 1,
        'status': 1,
        'taskType': 1,
        'FixtureData': 1,
        'FixtureData': {
          _id: '$FixtureData._id',
          clientId: '$FixtureData.clientId',
          clientId: '$FixtureData.clientId',
          fixtureCapacity: '$FixtureData.fixtureCapacity',
          fixtureCategory: '$FixtureData.fixtureCategory',
          fixtureLength: '$FixtureData.fixtureLength',
          fixtureLibraryId: '$FixtureData.fixtureLibraryId',
          fixtureName: '$FixtureData.fixtureName',
          fixtureStaticLength: '$FixtureData.fixtureStaticLength',
          fixtureStaticWidth: '$FixtureData.fixtureStaticWidth',
          fixtureType: '$FixtureData.fixtureType',
          fixtureWidth: '$FixtureData.fixtureWidth',
          footer: '$FixtureData.footer',
          header: '$FixtureData.header',
          isBodyEnabled: '$FixtureData.isBodyEnabled',
          productBrandName: '$FixtureData.productBrandName',
          productCategory: '$FixtureData.productCategory',
          productResolutionLevel: '$FixtureData.productResolutionLevel',
          productSubCategory: '$FixtureData.productSubCategory',
          shelfConfig: '$FixtureData.shelfConfig',
          status: '$FixtureData.status',
          templateIndex: '$FixtureData.templateIndex',
          shelfConfig: '$FixtureData.shelfConfig',
          vmConfig: {
            vmName: '$vmDetails.vmName',
            endYPosition: '$FixtureData.vmConfig.endYPosition',
            startYPosition: '$FixtureData.vmConfig.startYPosition',
            vmId: '$FixtureData.vmConfig.vmId',
            xZone: '$FixtureData.vmConfig.xZone',
            yZone: '$FixtureData.vmConfig.yZone',
            position: '$FixtureData.vmConfig.position',
          },
        },
      },
    },

    {
      $group: {
        _id: '$_id',
        answers: { $first: '$answers' },
        createdAt: { $first: '$createdAt' },
        date_iso: { $first: '$date_iso' },
        date_string: { $first: '$date_string' },
        fixtureId: { $first: '$fixtureId' },
        floorId: { $first: '$floorId' },
        planoId: { $first: '$planoId' },
        status: { $first: '$status' },
        taskType: { $first: '$taskType' },
        baseFixtureData: { $first: '$FixtureData' },
        collectedVmConfigs: {
          $push: '$FixtureData.vmConfig',
        },
      },
    },
    {
      $project: {
        _id: 1,
        answers: 1,
        createdAt: 1,
        date_iso: 1,
        date_string: 1,
        fixtureId: 1,
        floorId: 1,
        planoId: 1,
        status: 1,
        taskType: 1,
        FixtureData: {
          $mergeObjects: [
            '$baseFixtureData',
            {
              vmConfig: {
                $reduce: {
                  input: '$collectedVmConfigs',
                  initialValue: [],
                  in: {
                    $cond: [
                      { $isArray: '$$this' },
                      { $concatArrays: [ '$$value', '$$this' ] },
                      { $concatArrays: [ '$$value', [ '$$this' ] ] },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    },
    {
      $sort: { _id: -1 },
    },


    );


    let findvmCompliance = await planoTaskService.aggregate( queryVm );
    console.log( findvmCompliance );
    res.sendSuccess( { count: findfixtureCompliance.length, layoutData: findPlanoCompliance, fixtureData: findfixtureCompliance, VmData: findvmCompliance } );
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
    logger.error( { functionName: 'fixtureBrandsList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function fixtureVMList( req, res ) {
  try {
    let findData = await planoVmService.find( { clientId: req.query.clientId } );
    if ( findData.length === 0 ) {
      return res.sendError( 'nodata found', 204 );
    }
    res.sendSuccess( findData );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureVMList', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function updateFixtureStatus( req, res ) {
  try {
    console.log( req.body );

    let comments = {
      userId: req.user._id,
      userName: req.user.userName,
      role: req.user.role,
      responsetype: req.body.type,
      comment: req.body.comments,
    };
    console.log( comments );

    let updateResponse = await planoTaskService.updateOnefilters(
        { _id: new mongoose.Types.ObjectId( req.body._id ) },
        {
          $set: { 'answers.$[ans].issues.$[iss].Details.$[det].status': req.body.type },
        },
        [
          { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
          { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
          { 'det._id': new mongoose.Types.ObjectId( req.body.DetailsId ) },

        ] );
    if ( updateResponse&&updateResponse.answers.length>0 ) {
      console.log( updateResponse.answers[0] );
      let findissuse= updateResponse.answers[0].issues.filter( ( data ) => data._id==req.body.issueId );
      console.log( findissuse );
      let findDetails = findissuse[0].Details.filter( ( det ) => det.status==='agree' );
      console.log( '======', findDetails.length );
      if ( findissuse[0].Details.length=== findDetails.length ) {
        await planoTaskService.updateOnefilters(
            { _id: new mongoose.Types.ObjectId( req.body._id ) },
            {
              $set: { 'answers.$[ans].issues.$[iss].status': 'completed' },
            },
            [
              { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
              { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
            ] );
      }
      let findoneplanoData = await planoTaskService.findOne( { _id: new mongoose.Types.ObjectId( req.body._id ) } );
      console.log( '************', findoneplanoData.answers[0].issues );
      let totalApproved= findoneplanoData.answers[0].issues.filter( ( data ) => data.status==='pending' );
      console.log( '---------->', totalApproved.length );
      if ( totalApproved.length===0 ) {
        await planoTaskService.updateOne(
            {
              _id: new mongoose.Types.ObjectId( req.body._id ),
            },
            {
              'status': 'complete',
            },
        );
      }
    }

    if ( req.body.taskType==='layout' ) {
      await planoTaskService.updateOnefilters(
          { _id: new mongoose.Types.ObjectId( req.body._id ) },
          {
            $push: { 'answers.$[ans].issues.$[iss].Details.$[det].comments': comments },
          },
          [
            { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
            { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
            { 'det._id': new mongoose.Types.ObjectId( req.body.DetailsId ) },

          ] );
    } else {
      await planoTaskService.updateOnefilters(
          { _id: new mongoose.Types.ObjectId( req.body._id ) },
          {
            $push: { 'answers.$[ans].issues.$[iss].comments': comments },
          },
          [
            { 'ans._id': new mongoose.Types.ObjectId( req.body.answerId ) },
            { 'iss._id': new mongoose.Types.ObjectId( req.body.issueId ) },
          ] );
    }


    res.sendSuccess( 'updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateFixtureStatus', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateStoreFixture( req, res ) {
  try {
    const { fixtureId, data } = req.body;

    const currentFixture = await storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( fixtureId ) } );
    let currentFixtureDoc = currentFixture.toObject();

    const productBrandName = new Set();
    const productCategory = new Set();
    const productSubCategory = new Set();

    data.shelfConfig.forEach( ( shelf ) => {
      const { productBrandName: brand, productCategory: category, productSubCategory: subCategory } = shelf;

      if ( Array.isArray( brand ) ) {
        brand.forEach( ( b ) => productBrandName.add( b ) );
      }

      if ( Array.isArray( category ) ) {
        category.forEach( ( c ) => productCategory.add( c ) );
      }

      if ( Array.isArray( subCategory ) ) {
        subCategory.forEach( ( s ) => productSubCategory.add( s ) );
      }
    } );


    if ( currentFixtureDoc.fixtureConfigId.toString() !== data.fixtureConfigId ) {
      const newTemplate = await fixtureConfigService.findOne( { _id: data.fixtureConfigId } );
      currentFixtureDoc = {
        ...currentFixtureDoc,
        ...newTemplate.toObject(),
        fixtureConfigId: newTemplate.toObject()._id,
        productBrandName: [ ...productBrandName ],
        productCategory: [ ...productCategory ],
        productSubCategory: [ ...productSubCategory ],
      };
    } else {
      currentFixtureDoc = {
        ...currentFixtureDoc,
        ...data,
        productBrandName: [ ...productBrandName ],
        productCategory: [ ...productCategory ],
        productSubCategory: [ ...productSubCategory ],
      };
    }

    delete currentFixtureDoc._id;


    await storeFixtureService.updateOne( { _id: new mongoose.Types.ObjectId( fixtureId ) }, currentFixtureDoc );

    if ( data?.shelfConfig?.length ) {
      await fixtureShelfService.deleteMany( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) } );


      data.shelfConfig.forEach( async ( shelf ) => {
        delete shelf?._id;
        const additionalMeta = {
          clientId: currentFixture.clientId,
          storeId: currentFixture.storeId,
          storeName: currentFixture.storeName,
          planoId: currentFixture.planoId,
          floorId: currentFixture.floorId,
          fixtureId: currentFixture._id,
        };

        await fixtureShelfService.create( { ...additionalMeta, ...shelf } );
      } );
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateStoreFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateredostatus( req, res ) {
  try {
    console.log( '------->', req.body );
    if ( req.body.type==='layout' ) {
      await planoTaskService.updateOne(
          {
            planoId: new mongoose.Types.ObjectId( req.body.planoId ),
            floorId: new mongoose.Types.ObjectId( req.body.floorId ),
            type: req.body.type,
          },
          {
            'answers.$[].issues.$[].status': 'completed',
            'answers.$[].issues.$[].Details.$[].status': 'agree',
            'status': 'complete',
          },
      );
    } else {
      await planoTaskService.updateOne(
          {
            planoId: new mongoose.Types.ObjectId( req.body.planoId ),
            floorId: new mongoose.Types.ObjectId( req.body.floorId ),
            fixtureId: new mongoose.Types.ObjectId( req.body.fixtureId ),
            type: req.body.type,
          },
          {
            'answers.$[].issues.$[].status': 'completed',
            'answers.$[].issues.$[].Details.$[].status': 'agree',
            'status': 'complete',
          },
      );
    }
    res.sendSuccess( 'updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateredostatus', error: e } );
    return res.sendError( e, 500 );
  }
}
