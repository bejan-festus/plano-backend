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
      floorNumber: req.body.floorNumber,
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
    return res.sendSuccess( { message: 'Store Layout Created Successfully', id: planoId._id } );
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
    let getLayoutDetails = await planoService.findOne( { _id: req.body.id } );
    if ( !getLayoutDetails ) {
      return res.sendError( 'no data found', 204 );
    }
    let params = {
      storeName: getLayoutDetails.storeName,
      storeId: getLayoutDetails.storeId,
      layoutName: `${getLayoutDetails.storeName} - Layout`,
      clientId: getLayoutDetails.clientId,
      createdBy: req.user._id,
      createdByName: req.user.userName,
      createdByEmail: req.user.email,
      planoId: req.body.id,
    };
    let data = [];
    let num = getLayoutDetails.floorNumber + req.body.floorNumber;
    for ( let i=getLayoutDetails.floorNumber + 1; i <= num; i++ ) {
      data.push( { ...params, floorNumber: i, floorName: `floor ${i}` } );
    }
    getLayoutDetails.floorNumber = num;
    getLayoutDetails.save();
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
    ];
    if ( req.body?.sortColumnName == '' && req.body.sortBy == '' ) {
      query.push( { $sort: { createdAt: -1 } } );
    }
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
    if ( req.body?.sortColumnName != '' && req.body.sortBy != '' ) {
      query.push( {
        $sort: { [req.body.sortColumnName]: req.body.sortBy },
      } );
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
    let storeLayoutList = await planoService.aggregate( query );
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
    let planoData = [];
    let error = [];
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
    if ( !getStoreDetails.length ) {
      let invalidStoreList = [ ...new Set( req.body.data.map( ( ele ) => ele.storeName ) ) ];
      return res.sendError( [ { message: 'Invalid Stores', value: invalidStoreList } ], 400 );
    }
    let existStore = getStoreDetails.map( ( element ) => element.storeName.toLowerCase() );
    let invalidStoreList = req.body.data.filter( ( ele ) => !existStore.includes( ele.storeName.toLowerCase() ) );
    if ( invalidStoreList.length ) {
      invalidStoreList = [ ...new Set( invalidStoreList.map( ( ele ) => ele.storeName ) ) ];
      error.push( { message: 'Invalid Stores', value: invalidStoreList } );
    }
    storeList = [ ...new Set( getStoreDetails.map( ( item ) => item.storeId ) ) ];

    let duplicateStoreList = await planoService.find( { storeId: storeList } );
    if ( duplicateStoreList.length ) {
      let existStore = [];
      let planoIdList = duplicateStoreList.map( ( item ) => item._id );
      let getStorePlanoDetails = await storeBuilderService.find( { planoId: { $in: planoIdList } }, { floorNumber: 1, storeName: 1 } );
      if ( getStorePlanoDetails ) {
        getStorePlanoDetails.forEach( ( item ) => {
          let existsData = req.body.data.find( ( ele ) => ele.storeName.toLowerCase() == item.storeName.toLowerCase() && ele.floorNumber == item.floorNumber );
          if ( existsData ) {
            existStore.push( item.storeName );
          }
        } );
      }
      if ( existStore.length ) {
        error.push( { message: 'Duplicate Store Name', value: existStore } );
      }
    }

    if ( error.length ) {
      return res.sendError( error, 400 );
    }

    for ( let ele of getStoreDetails ) {
      let getNumber = req.body.data.filter( ( store ) => store.storeName == ele.storeName ).sort( ( a, b ) => b.floorNumber - a.floorNumber );
      let insertData = {
        storeName: ele.storeName,
        storeId: ele.storeId,
        layoutName: `${ele.storeName} - Layout`,
        clientId: req.body.clientId,
        createdBy: req.user._id,
        createdByName: req.user.userName,
        createdByEmail: req.user.email,
        floorNumber: getNumber?.[0]?.floorNumber,
      };
      let planoRes = await planoService.create( insertData );
      planoData.push( { id: planoRes._id, storeName: planoRes.storeName } );
    }

    req.body.data.forEach( ( item ) => {
      let findStore = data.find( ( ele ) => ele.storeName.toLowerCase() == item.storeName.toLowerCase() && ele.floorNumber == item.floorNumber );
      if ( !findStore ) {
        let getStoreData = req.body.data.filter( ( ele ) => ele.storeName.toLowerCase() == item.storeName.toLowerCase() && ele.floorNumber == item.floorNumber );
        getStoreData = getStoreData.sort( ( a, b ) => a.step - b.step );
        let layoutPolygon = [];
        getStoreData.forEach( ( ele ) => {
          let findEle = layoutPolygon.filter( ( element ) => element.elementType == ele.elements );
          layoutPolygon.push( {
            elementType: ele.elements,
            distance: ele.distance,
            unit: 'ft',
            direction: ele.direction,
            angle: ele.degree,
            elementNumber: findEle.length ? `${findEle.length + 1}` : `1`,
          } );
        } );

        let getStoreId = getStoreDetails.find( ( ele ) => ele.storeName == item.storeName );
        if ( getStoreId ) {
          let getPlanoId = planoData.find( ( ele ) => ele.storeName == item.storeName );
          data.push( {
            storeName: getStoreId.storeName,
            storeId: getStoreId.storeId,
            layoutName: `${item.storeName} - Layout`,
            clientId: req.body.clientId,
            createdBy: req.user._id,
            createdByName: req.user.userName,
            createdByEmail: req.user.email,
            layoutPolygon: layoutPolygon,
            floorNumber: item.floorNumber,
            floorName: `floor ${item.floorNumber}`,
            planoId: getPlanoId?.id,
          } );
        }
      }
    } );
    await storeBuilderService.insertMany( data );
    let planoIdList = planoData.map( ( ele ) => ele.id );
    return res.sendSuccess( { message: 'Bulk Stored upload successfully', id: planoIdList.toString() } );
  } catch ( e ) {
    logger.error( { functionName: 'uploadBulkStore', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function uploadFile( req, res ) {
  try {
    let getPlanoDetails = await planoService.findOne( { _id: req.body.id } );
    if ( !getPlanoDetails ) {
      return res.sendError( 'No data found' );
    }
    if ( req.files.file ) {
      let bucket = JSON.parse( process.env.Bucket );
      let params ={
        Bucket: bucket.storeBuilder,
        Key: `${getPlanoDetails.clientId}/${getPlanoDetails.storeName}/attachments/`,
        fileName: req.files.file.name,
        ContentType: req.files.file.mimetype,
        body: req.files.file.data,
      };
      let fileuploadRes = await fileUpload( params );
      if ( getPlanoDetails ) {
        let updateRes = await planoService.updateOne( { _id: getPlanoDetails. _id }, { $push: { attachments: fileuploadRes.Key } } );
        if ( updateRes.modifiedCount ) {
          let params = {
            Bucket: bucket.storeBuilder,
            file_path: fileuploadRes.Key,
          };
          let getSignedUrl = await signedUrl( params );
          return res.sendSuccess( { url: getSignedUrl, name: fileuploadRes.Key.split( '/' ).pop() } );
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
    let bucket = JSON.parse( process.env.BUCKET );
    for ( let attach of getAttachments?.attachments ) {
      let params = {
        Bucket: bucket.storeBuilder,
        file_path: attach,
      };
      let getSignedUrl = await signedUrl( params );
      getStoreDetails.attachments .push( { url: getSignedUrl, name: attach.split( '/' ).pop() } );
    }
    return res.sendSuccess( getStoreDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getStoreDetails', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeList( req, res ) {
  try {
    let idList = req.body.id.map( ( item ) => new mongoose.Types.ObjectId );
    let query = { _id: { $in: req.body.id } };
    let getStoreList = await planoService.find( query );
    if ( !getStoreList ) {
      return res.sendError( 'No data found', 204 );
    }
    idList = getStoreList.map( ( item ) => new mongoose.Types.ObjectId( item._id ) );
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
          floor: { $push: { floorName: '$floorName', id: '$_id', layoutPolygon: '$layoutPolygon' } },
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
      { $sort: { createdAt: -1 } },
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

export async function deleteStoreLayout( req, res ) {
  try {
    let getDetails = await planoService.findOne( { _id: req.params.id } );
    if ( !getDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    await storeBuilderService.deleteMany( { planoId: req.params.id } );
    await planoService.deleteOne( { _id: req.params.id } );
    return res.sendSuccess( 'Store layout successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteStoreLayout', error: e, message: req.params } );
    return res.sendError( e, 500 );
  }
}

export async function deleteFile( req, res ) {
  try {
    let getPlanoDetails = await planoService.findOne( { _id: req.body.id } );
    if ( !getPlanoDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    let updateFileRes = await planoService.updateOne( { _id: req.body.id }, { $unset: { 'attachments.0': req.body.fileIndex } } );
    updateFileRes = await planoService.updateOne( { _id: req.body.id }, { $pull: { 'attachments': null } } );
    if ( updateFileRes.matchedCount ) {
      return res.sendSuccess( 'File removed successfully' );
    }
  } catch ( e ) {
    logger.error( { functionName: 'deleteFile', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function deleteFloor( req, res ) {
  try {
    let getBuilderDetails = await storeBuilderService.findOne( { _id: req.body.id } );
    if ( !getBuilderDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    let planoDetails = await planoService.findOne( { _id: getBuilderDetails.planoId } );
    planoDetails.floorNumber = planoDetails.floorNumber - 1;
    planoDetails.save();

    await storeBuilderService.deleteOne( { _id: req.body.id } );
    return res.sendSuccess( 'Floor Deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteFloor', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function updateStatus( req, res ) {
  try {
    let getBuilderDetails = await planoService.find( { storeId: { $in: req.body.storeId } } );
    if ( !getBuilderDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }

    getBuilderDetails.status = req.body.status;
    await planoService.updateMany( { storeId: { $in: req.body.storeId } }, { status: req.body.status } );
    let planoId = getBuilderDetails.map( ( item ) => item._id );
    await storeBuilderService.updateMany( { planoId: { $in: planoId } }, { status: req.body.status } );

    return res.sendSuccess( 'Statu updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateStatus', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}


