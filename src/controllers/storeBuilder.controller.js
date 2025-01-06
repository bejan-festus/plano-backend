import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import { logger, fileUpload, signedUrl } from 'tango-app-api-middleware';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import mongoose from 'mongoose';
dayjs.extend( utc );
dayjs.extend( customParseFormat );

export async function createStoreBuilder( req, res ) {
  try {
    let data = [];
    let checkStoreLayoutExists = await planoService.findOne( { storeId: req.body.storeId, clientId: req.body.clientId } );
    if ( checkStoreLayoutExists ) {
      return res.sendError( 'Store already exists', 400 );
    }
    let insertData = {
      storeName: req.body.storeName,
      storeId: req.body.storeId,
      layoutName: `${req.body.storeName} - Layout`,
      clientId: req.body.clientId,
      createdBy: req.user._id,
      createdByName: req.user.userName,
      createdByEmail: req.user.email,
    };
    let planoId = await planoService.create( insertData );
    let params = {
      storeName: req.body.storeName,
      storeId: req.body.storeId,
      layoutName: `${req.body.storeName} - Layout`,
      clientId: req.body.clientId,
      createdBy: req.user._id,
      createdByName: req.user.userName,
      createdByEmail: req.user.email,
      planoId: planoId._id,
    };
    for ( let i=1; i<=req.body.floorNumber; i++ ) {
      data.push( { ...params, floorNumber: i, floorName: `floor ${i}` } );
    }
    await storeBuilderService.insertMany( data );
    return res.sendSuccess( 'Store Layout Created Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'createStoreBuilder', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateStoreLayout( req, res ) {
  try {
    let getLayoutDetails = await storeBuilderService.findOne( { _id: req.body.id } );
    if ( !getLayoutDetails ) {
      return res.sendError( 'no data found', 204 );
    }
    getLayoutDetails.status = req.body.status;
    getLayoutDetails.layoutPolygon = req.body.layoutPolygon;
    getLayoutDetails.save().then( () => {
      return res.sendSuccess( 'Store Layout Updated Successfully' );
    } ).catch( ( e ) => {
      return res.sendError( e, 500 );
    } );
  } catch ( e ) {
    logger.error( { functionName: 'updateStoreLayout', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateFloor( req, res ) {
  try {
    let getLayoutDetails = await storeBuilderService.findOne( { _id: req.body.id } );
    if ( !getLayoutDetails ) {
      return res.sendError( 'no data found', 204 );
    }
    delete getLayoutDetails._id;
    let data = [];
    for ( let i=1; i<req.body.floorNumber; i++ ) {
      data.push( { ...getLayoutDetails._doc, floorNumber: i, floorName: `floor ${i}` } );
    }
    await storeBuilderService.insertMany( data );
    return res.sendSuccess( 'Floor added successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateFloor', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getLayoutList( req, res ) {
  try {
    let limit = req.body?.limit || 10;
    let page = req.body?.offset || 0;
    let skip = limit * page;
    let query = [
      {
        $match: {
          clientId: req.body.clientId,
        },
      },
      {
        $group: {
          _id: '$storeName',
          floorNumber: { $sum: 1 },
          createdByName: { $last: '$createdByName' },
          layoutName: { $last: '$layoutName' },
          status: { $last: '$status' },
          floorName: { $last: '$floorName' },
          clientId: { $last: '$clientId' },
          storeId: { $last: '$storeId' },
          createdAt: { $last: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          storeName: '$_id',
          storeId: 1,
          layoutName: 1,
          floorName: 1,
          clientId: 1,
          createdByName: 1,
          floorNumber: 1,
          status: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];
    if ( req.body?.filter.length ) {
      query.push( {
        $match: {
          status: { $in: req.body.filter },
        },
      } );
    }
    if ( req.body.searchValue.length ) {
      let storeList = req.body.searchValue.split( ',' );
      if ( storeList.length > 1 ) {
        req.body.searchValue = storeList.map( ( ele ) => ele.toLowerCase() );
        query.push(
            {
              $addFields: {
                store: { $toLower: '$storeName' },
              },
            }, {
              $match: {
                store: { $in: req.body.searchValue },
              },
            },
        );
      } else {
        query.push(
            {
              $match: {
                storeName: { $regex: req.body.searchValue, $options: 'i' },
              },
            },
        );
      }
    }
    query.push( {
      $facet: {
        data: [
          { $limit: limit }, { $skip: skip },
        ],
        count: [
          { $count: 'total' },
        ],
      },
    } );
    if ( req.body?.sortColumnName != '' && req.body.sortBy != '' ) {
      query.push( {
        $sort: { [req.body.sortColumnName]: req.body.sortBy },
      } );
    }
    console.log( JSON.stringify( query ) );

    let storeLayoutList = await storeBuilderService.aggregate( query );
    console.log( storeLayoutList );
    if ( !storeLayoutList[0].data.length ) {
      return res.sendError( 'No data found', 204 );
    }

    storeLayoutList[0].data.forEach( ( ele ) => {
      ele.createdAt = dayjs.utc( ele.createdAt ).format( 'DD MMM, YYYY' );
    } );

    return res.sendSuccess( { data: storeLayoutList[0].data, count: storeLayoutList[0].count?.[0]?.total || 0 } );
  } catch ( e ) {
    logger.error( { functionName: 'getLayoutList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function uploadBulkStore( req, res ) {
  try {
    let data = [];
    let storeList = req.body.data.map( ( ele ) => ele['storeName'].toLowerCase() );
    let query = [
      {
        $addFields: {
          store: { $toLower: '$storeName' },
        },
      },
      {
        $match: {
          store: { $in: storeList },
          clientId: req.body.clientId,
        },
      },
      {
        $project: {
          storeName: 1,
          storeId: 1,
        },
      },
    ];
    let getStoreDetails = await storeService.aggregate( query );
    req.body.data.forEach( async ( item ) => {
      let findStore = data.find( ( ele ) => ele.storeName == item.storeName && ele.floorNumber == item.floorNumber );
      if ( !findStore ) {
        let getStoreData = req.body.data.filter( ( ele ) => ele.storeName == item.storeName && ele.floorNumber == item.floorNumber );
        getStoreData = getStoreData.sort( ( a, b ) => a.step - b.step );
        let layoutPolygon = [];
        getStoreData.forEach( ( ele ) => {
          layoutPolygon.push( {
            elementType: ele.elements,
            distance: ele.distance,
            unit: 'ft',
            direction: ele.direction,
            angle: ele.degree,
          } );
        } );

        let getStoreId = getStoreDetails.find( ( ele ) => ele.storeName == item.storeName );
        if ( getStoreId ) {
          data.push( {
            storeName: item.storeName,
            storeId: getStoreId.storeId,
            layoutName: `${item.storeName} - Layout`,
            clientId: req.body.clientId,
            createdBy: req.user._id,
            createdByName: req.user.userName,
            createdByEmail: req.user.email,
            layoutPolygon: layoutPolygon,
            floorNumber: item.floorNumber,
            floorName: `floor ${item.floorNumber}`,
          } );
        }
      }
    } );
    storeBuilderService.insertMany( data );
    return res.sendSuccess( 'Bulk Stored upload successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'uploadBulkStore', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function uploadFile( req, res ) {
  try {
    if ( req.files.file ) {
      let bucket = JSON.parse( process.env.Bucket );
      let params ={
        Bucket: bucket.storeBuilder,
        Key: `${req.body.clientId}/${req.body.storeName}/attachments/`,
        fileName: req.files.file.name,
        ContentType: req.files.file.mimetype,
        body: req.files.file.data,
      };
      let fileuploadRes = await fileUpload( params );
      let updateAttachments = await planoService.findOne( { storeName: req.body.storeName, clientId: req.body.clientId } );
      if ( updateAttachments ) {
        let updateRes = await planoService.updateOne( { _id: updateAttachments. _id }, { $push: { attachments: fileuploadRes.Key } } );
        if ( updateRes.modifiedCount ) {
          let params = {
            Bucket: bucket.storeBuilder,
            file_path: fileuploadRes.Key,
          };
          let getSignedUrl = await signedUrl( params );
          return res.sendSuccess( getSignedUrl );
        }
      } else {
        return res.sendError( 'Something went wrong', 500 );
      }
    }
  } catch ( e ) {
    logger.error( { functionName: 'uploadFile', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function getStoreDetails( req, res ) {
  try {
    let getStoreDetails = await storeService.findOne( { storeId: req.body.storeId, clientId: req.body.clientId } );
    if ( !getStoreDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    getStoreDetails = { ...getStoreDetails._doc, cameraBaseImage: '', attachments: [] };
    const camera = await storeService.findCamera( { storeId: req.body.storeId, isUp: true, isActivated: true }, { thumbnailImage: 1 } );
    if ( camera.thumbnailImage ) {
      const bucket= JSON.parse( process.env.BUCKET );
      const params = {
        file_path: camera.thumbnailImage,
        Bucket: bucket.baseImage,
      };
      const cameraBaseImage = await signedUrl( params );
      getStoreDetails.cameraBaseImage = cameraBaseImage;
    }

    let getAttachments = await planoService.findOne( { storeId: req.body.storeId, clientId: req.body.clientId }, { attachments: 1 } );
    getStoreDetails.attachments = getAttachments?.attachments;
    return res.sendSuccess( getStoreDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getStoreDetails', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeList( req, res ) {
  try {
    let query;
    if ( req.body.id ) {
      query = { _id: req.body.id };
    }
    if ( req.body.storeId ) {
      query = { storeId: { $in: req.body.storeId } };
    }
    let getStoreList = await planoService.find( query );
    if ( !getStoreList ) {
      return res.sendError( 'No data found', 204 );
    }
    let idList = getStoreList.map( ( item ) => new mongoose.Types.ObjectId( item._id ) );
    query = [
      {
        $match: {
          planoId: { $in: idList },
        },
      },
      {
        $group: {
          _id: '$storeName',
          storeId: { $first: '$storeId' },
          floor: { $push: { floorName: '$floorName', id: '$_id' } },
          planoId: { $first: '$planoId' },
        },
      },
      {
        $project: {
          _id: 0,
          storeName: '$_id',
          storeId: 1,
          floor: 1,
          planoId: 1,
        },
      },
    ];
    getStoreList = await storeBuilderService.aggregate( query );
    if ( !getStoreList.length ) {
      return res.sendError( 'No data found', 204 );
    }
    return res.sendSuccess( getStoreList );
  } catch ( e ) {
    logger.error( { functionName: 'storeList', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}
