import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import { logger, fileUpload, signedUrl } from 'tango-app-api-middleware';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import mongoose from 'mongoose';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as planoProductService from '../service/planoProduct.service.js';
import * as planoMappingService from '../service/planoMapping.service.js';
import * as planoComplianceService from '../service/planoCompliance.service.js';
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
    return res.sendSuccess( { message: 'Store layout created successfully', id: planoId._id } );
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
      return res.sendSuccess( 'Store layout updated successfully' );
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
    let page = req.body?.offset - 1 || 0;
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
          { $skip: skip }, { $limit: limit },
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
    return res.sendSuccess( { message: 'Bulk store upload successfully', id: planoIdList.toString() } );
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
      let bucket = JSON.parse( process.env.BUCKET );
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

export async function storeLayout( req, res ) {
  try {
    let idList = req.body.id.map( ( item ) => new mongoose.Types.ObjectId( item ) );
    let query = { _id: { $in: req.body.id } };
    let getPlanoDetails = await planoService.find( query );
    if ( !getPlanoDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    idList = getPlanoDetails.map( ( item ) => new mongoose.Types.ObjectId( item._id ) );
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
    let getStoreList = await storeBuilderService.aggregate( query );
    if ( !getStoreList.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let fixtureDetails = await storeFixtureService.find( { planoId: { $in: idList } } );
    for ( let layout of getStoreList ) {
      for ( let floor of layout.floor ) {
        for ( let polygon of floor.layoutPolygon ) {
          let polygonfixtureDetails = fixtureDetails.filter( ( ele ) => layout.planoId.toString() == ele.planoId.toString() && ele.floorId.toString() == floor.id.toString() && ele.associatedElementType == polygon.elementType && ele.associatedElementNumber == polygon.elementNumber );
          let fixtures = [];
          for ( let fixture of polygonfixtureDetails ) {
            let data = { ...fixture._doc, status: '' };
            let query = [
              {
                $match: {
                  fixtureId: fixture._id,
                },
              },
              {
                $group: {
                  _id: '',
                  count: { $sum: '$shelfCapacity' },
                  fixtureId: { $first: '$fixtureId' },
                },
              },
              {
                $lookup: {
                  from: 'planocompliances',
                  let: { 'id': '$fixtureId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { date: new Date( dayjs().format( 'YYYY-MM-DD' ) ) },
                            { $eq: [ '$fixtureId', '$$id' ] },
                            { $eq: [ '$compliance', 'proper' ] },
                          ],
                        },
                      },
                    },
                    {
                      $group: {
                        _id: '',
                        count: { $sum: 1 },
                      },
                    },
                  ],
                  as: 'planoCompliance',
                },
              },
            ];
            let fixtureDetails = await fixtureShelfService.aggregate( query );
            if ( fixtureDetails.length ) {
              data.status = fixtureDetails[0]?.planoCompliance?.length ? fixtureDetails[0].count == fixtureDetails[0]?.planoCompliance?.count ? 'complete' : 'incomplete' : '';
            }
            fixtures.push( data );
          }
          polygon.fixture = fixtures;
        }
        floor.centerFixture = fixtureDetails.filter( ( ele ) => layout.planoId.toString() == ele.planoId.toString() && ele.floorId.toString() == floor.id.toString() && ele.fixtureType == 'floor' );
      }
    }
    return res.sendSuccess( { FloorDetails: getStoreList, productResolutionLevel: getPlanoDetails?.productResolutionLevel || '', productResolutionFilters: getPlanoDetails?.productResolutionFilters || [] } );
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
    return res.sendSuccess( 'Layout deleted successfully' );
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
    return res.sendSuccess( 'Floor deleted successfully' );
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

    return res.sendSuccess( 'Status updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateStatus', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function fixtureShelfProduct( req, res ) {
  try {
    if ( !req.body.fixtureId ) {
      return res.sendError( 'Fixture id is required', 400 );
    }

    let fixtureDetails = await storeFixtureService.findOne( { _id: req.body.fixtureId } );
    if ( !fixtureDetails ) {
      return res.sendError( 'Fixture not found', 204 );
    }
    // let planoDetails = await planoService.findOne( { _id: fixtureDetails.planoId } );
    let shelfDetails = await fixtureShelfService.find( { fixtureId: req.body.fixtureId } );
    // let query;
    // switch ( planoDetails.productResolutionLevel ) {
    //   case 'L1':
    //     query = { floorId: fixtureDetails.floorId };
    //     break;
    //   default:
    //     query = { floorId: fixtureDetails.floorId, fixtureId: req.body.fixtureId };
    //     break;
    // }
    //  query = {
    //     ...query,
    //     ...( [ 'L3', 'L4' ].includes( planoDetails.productResolutionLevel ) ) ? { shelfId: shelf._id } : {},
    //     productId: { $in: productIdList },
    //     date: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
    //   };
    let shelfList = [];
    for ( let shelf of shelfDetails ) {
      let data = { ...shelf._doc, products: [] };
      let productMappingDetails = await planoMappingService.find( { shelfId: shelf._id } );
      let productIdList = productMappingDetails.map( ( item ) => item.productId );
      let productDetails = await planoProductService.find( { _id: productIdList } );
      let productComplianceDetails = await planoComplianceService.find( { date: new Date( dayjs().format( 'YYYY-MM-DD' ) ), shelfId: shelf._id } );
      let product = [];
      productDetails.forEach( ( item ) => {
        let data = { ...item._doc, status: 'missing', rfId: '' };
        let getPosition = productMappingDetails.find( ( ele ) => ele.productId.toString() == item._id.toString() );
        let findCompliance = productComplianceDetails.find( ( ele ) => ele.shelfPosition == getPosition.shelfPosition );
        if ( findCompliance ) {
          data.status = findCompliance.compliance;
        }
        data.rfId = getPosition.rfId;
        product.push( data );
      } );
      data.products = product;
      shelfList.push( data );
    }
    fixtureDetails = { ...fixtureDetails._doc, shelves: shelfList };
    return res.sendSuccess( fixtureDetails );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureShelfProduct', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function scan( req, res ) {
  try {
    let shelfId;
    if ( !req.body.planoId ) {
      return res.sendError( 'Plano id is required', 400 );
    }
    if ( !req.body.rfId ) {
      return res.sendError( 'RFID is required', 400 );
    }
    let planoDetails = await planoService.findOne( { _id: req.body.planoId } );
    if ( !planoDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    if ( ![ 'L1', 'L2' ].includes( planoDetails.productResolutionLevel ) ) {
      if ( !req.body.shelfId ) {
        let shelfDetails = await fixtureShelfService.findOne( { rfId: req.body.rfId } );
        if ( !shelfDetails ) {
          return res.sendError( 'Please scan shelf first', 400 );
        }
        return res.sendSuccess( shelfDetails._id );
      }
    }
    if ( planoDetails.productResolutionLevel == 'L5' ) {
      let shelfDetails = await fixtureShelfService.findOne( { _id: req.body.shelfId } );
      if ( !shelfDetails ) {
        return res.sendError( 'No data found', 204 );
      }
      if ( shelfDetails.shelfCapacity < req.body.shelfPosition ) {
        return res.sendError( 'Shelf capacity exceeded', 400 );
      }
      shelfDetails = await fixtureShelfService.find( { sectionName: shelfDetails?.sectionName } );
      shelfId = req.body.shelfId;
      req.body.shelfId = shelfDetails.map( ( ele ) => ele._id );
    }
    let productCheck= await planoMappingService.findOne( { rfId: req.body.rfId } );
    if ( !productCheck ) {
      return res.sendError( 'Product not found', 400 );
    }
    let query;
    switch ( planoDetails.productResolutionLevel ) {
      case 'L1':
        if ( !req.body.floorId ) {
          return res.sendError( 'Floor id is required', 400 );
        }
        query = { floorId: req.body.floorId };
        break;
      case 'L2':
        if ( !req.body.floorId ) {
          return res.sendError( 'Floor id is required', 400 );
        }
        if ( !req.body.fixtureId ) {
          return res.sendError( 'Fixture id is required', 400 );
        }
        query = { floorId: req.body.floorId, fixtureId: req.body.fixtureId };
        break;
      case 'L3':
        if ( !req.body.floorId ) {
          return res.sendError( 'Floor id is required', 400 );
        }
        if ( !req.body.fixtureId ) {
          return res.sendError( 'Fixture id is required', 400 );
        }
        if ( !req.body.shelfId ) {
          return res.sendError( 'Shelf id is required', 400 );
        }
        query = { floorId: req.body.floorId, fixtureId: req.body.fixtureId, shelfId: req.body.shelfId };
        break;
      case 'L4':
        if ( !req.body.floorId ) {
          return res.sendError( 'Floor id is required', 400 );
        }
        if ( !req.body.fixtureId ) {
          return res.sendError( 'Fixture id is required', 400 );
        }
        if ( !req.body.shelfId ) {
          return res.sendError( 'Shelf id is required', 400 );
        }
        if ( !req.body.shelfPosition ) {
          return res.sendError( 'Shelf position is required', 400 );
        }
        query = { floorId: req.body.floorId, fixtureId: req.body.fixtureId, shelfId: req.body.shelfId, shelfPosition: req.body.shelfPosition };
        break;
      case 'L5':
        if ( !req.body.floorId ) {
          return res.sendError( 'Floor id is required', 400 );
        }
        if ( !req.body.fixtureId ) {
          return res.sendError( 'Fixture id is required', 400 );
        }
        if ( !req.body.shelfId ) {
          return res.sendError( 'Shelf id is required', 400 );
        }
        query = { floorId: req.body.floorId, fixtureId: req.body.fixtureId, shelfId: { $in: req.body.shelfId } };
        break;
      default:
        return res.sendError( 'Product not found', 400 );
        break;
    }
    query = { ...query, rfId: req.body.rfId };
    console.log( query );

    let planoProductDetails = await planoMappingService.findOne( query );
    let data = {
      ...( planoProductDetails ) ? { ...planoProductDetails._doc } : { planoId: req.body?.planoId, floorId: req.body?.floorId, fixtureId: req.body?.fixtureId, shelfId: shelfId, clientId: planoDetails.clientId, storeName: planoDetails.storeName, storeId: planoDetails.storeId, shelfPosition: req.body?.shelfPosition },
      rfId: req.body.rfId,
      compliance: !planoProductDetails ? 'misplaced' : 'proper',
      date: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
    };
    delete data._id;
    query = { ...query, date: new Date( dayjs().format( 'YYYY-MM-DD' ) ), shelfPosition: planoProductDetails?.shelfPosition || req.body.shelfPosition };
    await planoComplianceService.updateOne( query, data );
    if ( !planoProductDetails ) {
      return res.sendSuccess( false );
    }
    return res.sendSuccess( true );
  } catch ( e ) {
    logger.error( { functonName: 'scan', error: e } );
    return res.sendError( e, 500 );
  }
}
