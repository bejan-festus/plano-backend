import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import { logger, fileUpload, signedUrl, sendMessageToQueue } from 'tango-app-api-middleware';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import mongoose from 'mongoose';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as planoProductService from '../service/planoProduct.service.js';
import * as planoMappingService from '../service/planoMapping.service.js';
import * as planoComplianceService from '../service/planoCompliance.service.js';
import * as planoTaskComplianceService from '../service/planoTask.service.js';
import * as planoQrConversionRequestService from '../service/planoQrConversionRequest.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as planoStaticData from '../service/planoStaticData.service.js';
import * as planoVmService from '../service/planoVm.service.js';


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
    for ( let i = 1; i <= req.body.floorNumber; i++ ) {
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
    for ( let i = getLayoutDetails.floorNumber + 1; i <= num; i++ ) {
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
      let params = {
        Bucket: bucket.storeBuilder,
        Key: `${getPlanoDetails.clientId}/${getPlanoDetails.storeName}/attachments/`,
        fileName: req.files.file.name,
        ContentType: req.files.file.mimetype,
        body: req.files.file.data,
      };
      let fileuploadRes = await fileUpload( params );
      if ( getPlanoDetails ) {
        let updateRes = await planoService.updateOne( { _id: getPlanoDetails._id }, { $push: { attachments: fileuploadRes.Key } } );
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
      const bucket = JSON.parse( process.env.BUCKET );
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
      getStoreDetails.attachments.push( { url: getSignedUrl, name: attach.split( '/' ).pop() } );
    }
    return res.sendSuccess( getStoreDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getStoreDetails', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeLayout( req, res ) {
  try {
    const planoIds = req.body.id.map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find( { _id: { $in: planoIds } }, { storeId: 1, storeName: 1, planoId: '$_id' } );

    if ( !planograms?.length ) {
      return res.sendError( 'No data found', 204 );
    }

    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floorList = await storeBuilderService.find( { planoId: planogram._id }, { floorName: 1, layoutPolygon: 1, crestLayout: true } );

          const floors = floorList.map( ( floor ) => {
            return floor.toObject();
          } );
          return {
            ...planogram.toObject(),
            floors,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeLayoutv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeFixtures( req, res ) {
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
    let fixtureList = fixtureDetails.map( ( ele ) => ele._id );
    let fixtureQuery = [
      {
        $match: {
          fixtureId: { $in: fixtureList },
        },
      },
      {
        $group: {
          _id: '$fixtureId',
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
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$fixtureId',
                properCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: [ '$compliance', 'proper' ] },
                        ],
                      }, 1, 0 ],
                  },
                },
                misPlacedCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: [ '$compliance', 'proper' ] },
                        ],
                      }, 1, 0 ],
                  },
                },
              },
            },
          ],
          as: 'planoCompliance',
        },
      },
    ];
    let fixtureStatus = await fixtureShelfService.aggregate( fixtureQuery );
    for ( let layout of getStoreList ) {
      for ( let floor of layout.floor ) {
        for ( let polygon of floor.layoutPolygon ) {
          let polygonfixtureDetails = fixtureDetails.filter( ( ele ) => layout.planoId.toString() == ele.planoId.toString() && ele.floorId.toString() == floor.id.toString() && ele.associatedElementType == polygon.elementType && ele.associatedElementNumber == polygon.elementNumber );
          polygonfixtureDetails.forEach( ( fixtureEle, index ) => {
            let updateFixture = { ...fixtureEle._doc, status: '' };
            let getFixtureStatus = fixtureStatus.find( ( statusElem ) => statusElem.fixtureId.toString() == fixtureEle._id.toString() );
            if ( getFixtureStatus && getFixtureStatus?.planoCompliance?.length ) {
              updateFixture.status = getFixtureStatus.count == getFixtureStatus?.planoCompliance?.properCount ? 'complete' : 'incomplete';
            }
            polygonfixtureDetails[index] = updateFixture;
          } );

          polygon.fixture = polygonfixtureDetails;
        }
        floor.centerFixture = fixtureDetails.filter( ( ele ) => layout.planoId.toString() == ele.planoId.toString() && ele.floorId.toString() == floor.id.toString() && ele.fixtureType == 'floor' );
        floor.centerFixture.forEach( ( centerFixture, index ) => {
          let centerList = { ...centerFixture._doc, status: '' };
          let getFixtureStatus = fixtureStatus.find( ( statusElem ) => statusElem.fixtureId.toString() == centerFixture._id.toString() );
          if ( getFixtureStatus && getFixtureStatus?.planoCompliance?.length ) {
            centerList.status = getFixtureStatus.count == getFixtureStatus?.planoCompliance?.properCount ? 'complete' : 'incomplete';
          }
          floor.centerFixture[index] = centerList;
        } );
      }
    }
    return res.sendSuccess( { FloorDetails: getStoreList, productResolutionLevel: getPlanoDetails?.productResolutionLevel || '', productResolutionFilters: getPlanoDetails?.productResolutionFilters || [] } );
  } catch ( e ) {
    logger.error( { functionName: 'storeList', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeFixturesv1( req, res ) {
  try {
    const planoIds = req.body.id
        .filter( ( id ) => mongoose.Types.ObjectId.isValid( id ) )
        .map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        {
          $or: [
            { _id: { $in: planoIds } },
            { storeId: { $in: req.body.id } },
          ],
        },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1, scanType: 1, clientId: 1, validateShelfSections: 1 },
    );

    if ( !planograms?.length ) return res.sendError( 'No data found', 204 );

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floors = await storeBuilderService.find(
              { planoId: planogram._id },
              { floorName: 1, layoutPolygon: 1, planoId: 1 },
          );

          const floorsWithFixtures = await Promise.all(
              floors.map( async ( floor ) => {
                let productCapacity = 0;
                let fixtureCount = 0;
                const layoutPolygonWithFixtures = await Promise.all(
                    floor.layoutPolygon.map( async ( element ) => {
                      const fixtures = await storeFixtureService.findAndSort( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'wall',
                      }, { shelfcount: 0 }, { fixtureNumber: 1 } );

                      const fixturesWithStatus = await Promise.all(
                          fixtures.map( async ( fixture ) => {
                            if ( fixture?.imageUrl ) {
                              let params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: fixture.imageUrl,
                              };
                              fixture.imageUrl = await signedUrl( params );
                            } else {
                              fixture.imageUrl = '';
                            }
                            productCapacity += fixture.toObject().fixtureCapacity;
                            fixtureCount += 1;
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                            const complianceCount = await planoComplianceService.count( {
                              fixtureId: fixture._id,
                              compliance: 'proper',
                              date: currentDate,
                            } );

                            const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                            const shelfDetails = await Promise.all(
                                shelves.map( async ( shelf ) => {
                                  const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                                  const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                                  return {
                                    ...shelf.toObject(),
                                    productCount: productCount,
                                    vmCount: vmCount,
                                  };
                                } ),
                            );

                            let fixtureStatus;

                            const cvProcessStatus = await planoQrConversionRequestService.count( { fixtureId: fixture._id, date: currentDate, status: 'initiated' } );

                            if ( cvProcessStatus ) {
                              fixtureStatus = 'inprogress';
                            } else {
                              const missingCount = await planoComplianceService.count( {
                                fixtureId: fixture._id,
                                compliance: 'missing',
                                date: currentDate,
                              } );
                              fixtureStatus = complianceCount === 0 && !missingCount ? '' : complianceCount === productCount ? 'complete' : 'incomplete';
                            }

                            const vms = await planoMappingService.find( { fixtureId: fixture._id, type: 'vm' } );

                            const vmDetails = await Promise.all( vms.map( async ( vm ) => {
                              const vmTemplate = await planoProductService.findOne( { _id: vm.toObject().productId } );
                              const params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: vmTemplate?.productImageUrl,
                              };
                              const vmImage = await signedUrl( params );
                              return {
                                ...vm.toObject(),
                                ...vmTemplate?.toObject(),
                                ...( typeof vmImage === 'string' && { productImageUrl: vmImage } ),
                              };
                            } ) );

                            return {
                              ...fixture.toObject(),
                              status: fixtureStatus,
                              shelfCount: shelves.length,
                              productCount: productCount,
                              vmCount: vmCount,
                              shelfDetails: shelfDetails,
                              vms: vmDetails,
                            };
                          } ),
                      );

                      const otherElements = await storeFixtureService.find( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'other',
                      } );

                      return {
                        ...element,
                        fixtures: fixturesWithStatus,
                        otherElements: otherElements,
                      };
                    } ),
                );

                const centerFixtures = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'floor',
                } );

                const centerFixturesWithStatus = await Promise.all(
                    centerFixtures.map( async ( fixture ) => {
                      if ( fixture?.imageUrl ) {
                        let params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: fixture.imageUrl,
                        };
                        fixture.imageUrl = await signedUrl( params );
                      } else {
                        fixture.imageUrl = '';
                      }
                      productCapacity += fixture.toObject().fixtureCapacity;
                      fixtureCount += 1;

                      const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                      const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                      const complianceCount = await planoComplianceService.count( {
                        fixtureId: fixture._id,
                        compliance: 'proper',
                        date: currentDate,
                      } );

                      const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                      const shelfDetails = await Promise.all(
                          shelves.map( async ( shelf ) => {
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                            return {
                              ...shelf.toObject(),
                              productCount: productCount,
                              vmCount: vmCount,
                            };
                          } ),
                      );

                      let fixtureStatus;

                      const cvProcessStatus = await planoQrConversionRequestService.count( { fixtureId: fixture._id, date: currentDate, status: 'initiated' } );

                      if ( cvProcessStatus ) {
                        fixtureStatus = 'inprogress';
                      } else {
                        const missingCount = await planoComplianceService.count( {
                          fixtureId: fixture._id,
                          compliance: 'missing',
                          date: currentDate,
                        } );
                        fixtureStatus = complianceCount === 0 && !missingCount ? '' : complianceCount === productCount ? 'complete' : 'incomplete';
                      }

                      const vms = await planoMappingService.find( { fixtureId: fixture._id, type: 'vm' } );

                      const vmDetails = await Promise.all( vms.map( async ( vm ) => {
                        const vmTemplate = await planoProductService.findOne( { _id: vm.toObject().productId } );
                        const params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: vmTemplate?.productImageUrl,
                        };
                        const vmImage = await signedUrl( params );
                        return {
                          ...vm.toObject(),
                          ...vmTemplate?.toObject(),
                          ...( typeof vmImage === 'string' && { productImageUrl: vmImage } ),

                        };
                      } ) );

                      return {
                        ...fixture.toObject(),
                        status: fixtureStatus,
                        shelfCount: shelves.shelves,
                        productCount: productCount,
                        vmCount: vmCount,
                        shelfDetails: shelfDetails,
                        vms: vmDetails,
                      };
                    } ),
                );

                // const productCount = await planoMappingService.count( { floorId: floor._id } );

                const otherElements = await storeFixtureService.find( {
                  floorId: floor._id,
                  associatedElementType: { $exists: false },
                  associatedElementNumber: { $exists: false },
                  fixtureType: 'other',
                } );

                return {
                  ...floor.toObject(),
                  layoutPolygon: layoutPolygonWithFixtures,
                  centerFixture: centerFixturesWithStatus,
                  productCount: productCapacity,
                  fixtureCount: fixtureCount,
                  // productCapacity: productCapacity,
                  otherElements: otherElements,
                };
              } ),
          );

          return {
            ...planogram.toObject(),
            floors: floorsWithFixtures,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeFixturesv1', error: e, message: req.body } );
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


export async function fixtureShelfProductv1( req, res ) {
  try {
    const { planoId, fixtureId } = req.body;

    const [ planogram, fixture ] = await Promise.all( [
      planoService.findOne(
          { _id: new mongoose.Types.ObjectId( planoId ) },
          { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
      ),
      storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( fixtureId ) } ),
    ] );

    if ( !planogram ) return res.sendError( 'Planogram not found', 204 );
    if ( !fixture ) return res.sendError( 'Fixture not found', 204 );

    let params = {
      Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
      file_path: fixture.imageUrl,
    };

    fixture.imageUrl = await signedUrl( params );
    let fixtureConfigDetails = await fixtureConfigService.findOne( { _id: fixture?.fixtureConfigId } );

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const getProducts = async ( mappings ) => {
      const productIds = mappings.map( ( mapping ) => mapping.productId );
      const products = await planoProductService.find( { _id: { $in: productIds }, type: 'product' } );
      const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );

      return await Promise.all(
          mappings.map( async ( mapping ) => {
            const productData = productMap.get( mapping?.productId?.toString() ) || {};
            delete productData._id;
            const mappingCompliance = await planoComplianceService.findOne( {
              planoMappingId: mapping._id,
              date: currentDate,
            } );
            const status = mappingCompliance ? mappingCompliance.compliance : '';
            return { ...mapping.toObject(), ...productData, status };
          } ),
      );
    };

    const vmMappings = await planoMappingService.find( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'vm' } );
    const vmIds = vmMappings.map( ( mapping ) => mapping.productId );
    const vms = await planoProductService.find( { _id: { $in: vmIds }, type: 'vm' } );
    await Promise.all( vms.map( async ( vm ) => {
      if ( vm?.productImageUrl ) {
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          file_path: vm?.productImageUrl,
        };
        vm.productImageUrl = await signedUrl( params );
      }
    } ) );
    const vmMap = new Map( vms.map( ( vm ) => [ vm._id.toString(), vm.toObject() ] ) );
    const vmDetails = vmMappings.map( ( mapping ) => ( {
      ...vmMap.get( mapping.productId.toString() ),
      _id: mapping._id,
    } ) );

    if ( fixture.toObject().productResolutionLevel === 'L1' ) {
      const productMappings = await planoMappingService.find( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'product' } );
      const productDetails = await getProducts( productMappings );
      return res.sendSuccess( { ...fixture.toObject(), fixtureConfigLength: fixtureConfigDetails?.fixtureLength, products: productDetails, vms: vmDetails, productCount: productMappings.length } );
    }

    if ( [ 'L2', 'L3', 'L4' ].includes( fixture.toObject().productResolutionLevel ) ) {
      const fixtureShelves = await fixtureShelfService.findAndSort( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) }, {}, { shelfNumber: 1 } );
      // if ( !fixtureShelves.length ) return res.sendError( 'No shelves found for the fixture', 204 );
      const productCount = await planoMappingService.count( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'product' } );
      const shelfProducts = await Promise.all(
          fixtureShelves.map( async ( shelf ) => {
            const productMappings = await planoMappingService.find( { shelfId: shelf._id, type: 'product' } );
            const productDetails = await getProducts( productMappings );
            return { ...shelf.toObject(), products: productDetails };
          } ),
      );
      return res.sendSuccess( { ...fixture.toObject(), fixtureConfigLength: fixtureConfigDetails?.fixtureLength, shelves: shelfProducts, vms: vmDetails, productCount: productCount } );
    }

    // if ( fixture.toObject().productResolutionLevel === 'L3' ) {
    //   const fixtureShelves = await fixtureShelfService.findAndSort( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) }, {}, { shelfNumber: 1 } );
    //   // if ( !fixtureShelves.length ) return res.sendError( 'No shelves found for the fixture', 204 );
    //   const productCount = await planoMappingService.count( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'product' } );
    //   const groupedShelves = fixtureShelves.reduce( async ( accPromise, shelf ) => {
    //     const acc = await accPromise;
    //     const productMappings = await planoMappingService.find( { shelfId: shelf._id, type: 'product' } );
    //     const productDetails = await getProducts( productMappings );
    //     const sectionName = shelf.sectionName || 'Unknown';
    //     if ( !acc[sectionName] ) acc[sectionName] = [];
    //     acc[sectionName].push( { ...shelf.toObject(), products: productDetails } );
    //     return acc;
    //   }, Promise.resolve( {} ) );
    //   return res.sendSuccess( { ...fixture.toObject(), fixtureConfigLength: fixtureConfigDetails?.fixtureLength, categories: await groupedShelves, vms: vmDetails, productCount: productCount } );
    // }

    return res.sendError( 'Incorrect resolution level', 400 );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureShelfProductv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}


export async function scanv1( req, res ) {
  try {
    if ( !req.body.floorId ) return res.sendError( 'Floor id is required', 400 );

    if ( !req.body.fixtureId ) return res.sendError( 'Fixture id is required', 400 );

    if ( !req.body.rfId ) return res.sendError( 'RFID is required', 400 );
    const fixture = await storeFixtureService.findOne(
        { _id: new mongoose.Types.ObjectId( req.body.fixtureId ) },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
    );

    if ( !fixture ) return res.sendError( 'No data found', 204 );

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );


    if ( fixture.productResolutionLevel === 'L1' ) {
      const mappingQuery = {
        planoId: req.body.planoId,
        floorId: req.body.floorId,
        fixtureId: req.body.fixtureId,
        rfId: req.body.rfId,
      };

      const productMapping = await planoMappingService.findOne( mappingQuery );

      if ( !productMapping ) {
        const misplacedQuery = {
          planoId: req.body.planoId,
          floorId: req.body.floorId,
          rfId: req.body.rfId,
        };
        const misplacedProductMapping = await planoMappingService.findOne( misplacedQuery );

        if ( !misplacedProductMapping ) {
          return res.sendSuccess( { data: null, status: 'missing' } );
        }

        const complianceData = { ...misplacedProductMapping.toObject(), planoMappingId: misplacedProductMapping.toObject()._id, compliance: 'misplaced' };
        delete complianceData._id;

        let misplacedProductDetails = await planoProductService.findOne( { _id: misplacedProductMapping.toObject().productId } );

        await planoComplianceService.updateOne( { ...misplacedQuery, date: currentDate }, complianceData );

        const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          proper: properProducts,
          missing: missingProducts,
        };

        return res.sendSuccess( { data: { ...misplacedProductMapping.toObject(), ...( misplacedProductDetails ? misplacedProductDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),

      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        proper: properProducts,
        missing: missingProducts,
      };

      return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'proper' } );
    } else if ( fixture.productResolutionLevel === 'L2' ) {
      if ( !req.body.shelfId && req.body.rfId ) {
        const shelf = await fixtureShelfService.findOne( { planoId: req.body.planoId, floorId: req.body.floorId, fixtureId: req.body.fixtureId, rfId: req.body.rfId } );
        if ( !shelf ) return res.sendError( 'No matching shelf for the rfId', 400 );
        const [ shelfProducts, shelfCompliance ] = await Promise.all( [
          planoMappingService.count( { shelfId: shelf.toObject()._id } ),
          planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
        ] );
        return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
          isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
      }

      if ( !req.body.shelfId ) return res.sendError( 'Shelf id is required', 400 );

      const mappingQuery = {
        planoId: req.body.planoId,
        floorId: req.body.floorId,
        fixtureId: req.body.fixtureId,
        shelfId: req.body.shelfId,
        rfId: req.body.rfId,
      };

      const productMapping = await planoMappingService.findOne( mappingQuery );

      if ( !productMapping ) {
        const misplacedQuery = {
          planoId: req.body.planoId,
          floorId: req.body.floorId,
          rfId: req.body.rfId,
        };
        const misplacedProductMapping = await planoMappingService.findOne( misplacedQuery );

        if ( !misplacedProductMapping ) {
          const shelf = await fixtureShelfService.findOne( misplacedQuery );
          if ( !shelf ) {
            return res.sendSuccess( { data: null, status: 'missing' } );
          }
          const [ shelfProducts, shelfCompliance ] = await Promise.all( [
            planoMappingService.count( { shelfId: shelf.toObject()._id } ),
            planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
          ] );
          return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
            isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
        }

        const complianceData = { ...misplacedProductMapping.toObject(), planoMappingId: misplacedProductMapping.toObject()._id, compliance: 'misplaced' };
        delete complianceData._id;

        let misplacedProductDetails = await planoProductService.findOne( { _id: misplacedProductMapping.toObject().productId } );

        const isComplianceProper = await planoComplianceService.count( { ...misplacedQuery, date: currentDate, compliance: 'proper' } );
        if ( !isComplianceProper ) {
          await planoComplianceService.updateOne( { ...misplacedQuery, date: currentDate, compliance: { $ne: 'proper' } }, complianceData );
        }

        const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          proper: properProducts,
          missing: missingProducts,
        };

        return res.sendSuccess( { data: { ...misplacedProductMapping.toObject(), ...( misplacedProductDetails ? misplacedProductDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        proper: properProducts,
        missing: missingProducts,
      };

      const [ shelfProducts, shelfCompliance ] = await Promise.all( [
        planoMappingService.count( { shelfId: productMapping.toObject().shelfId } ),
        planoComplianceService.count( { date: currentDate, shelfId: productMapping.toObject().shelfId, compliance: 'proper' } ),
      ] );

      const shelfMetrics = {
        shelfId: productMapping.toObject().shelfId,
        isScanned: shelfCompliance >= shelfProducts/2 ? true : false };


      return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, shelfMetrics: shelfMetrics, status: 'proper' } );
    } else if ( fixture.productResolutionLevel === 'L3' ) {
      if ( !req.body.shelfId && req.body.rfId ) {
        const shelf = await fixtureShelfService.findOne( { planoId: req.body.planoId, floorId: req.body.floorId, fixtureId: req.body.fixtureId, rfId: req.body.rfId } );
        if ( !shelf ) return res.sendError( 'No matching shelf for the rfId', 400 );
        const [ shelfProducts, shelfCompliance ] = await Promise.all( [
          planoMappingService.count( { shelfId: shelf.toObject()._id } ),
          planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
        ] );
        return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
          isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
      }

      if ( !req.body.shelfId ) return res.sendError( 'Shelf id is required', 400 );

      const mappingQuery = {
        planoId: req.body.planoId,
        floorId: req.body.floorId,
        fixtureId: req.body.fixtureId,
        shelfId: req.body.shelfId,
        rfId: req.body.rfId,
      };

      const productMapping = await planoMappingService.findOne( mappingQuery );

      if ( !productMapping ) {
        const shelf = await fixtureShelfService.findOne( { _id: new mongoose.Types.ObjectId( req.body.shelfId ) } );

        if ( !shelf ) {
          return res.sendError( 'Invalid shelf Id', 400 );
        }
        const misplacedQuery = {
          planoId: req.body.planoId,
          floorId: req.body.floorId,
          rfId: req.body.rfId,
        };
        const misplacedProductMapping = await planoMappingService.findOne( misplacedQuery );


        if ( !misplacedProductMapping ) {
          const shelf = await fixtureShelfService.findOne( misplacedQuery );
          if ( !shelf ) {
            return res.sendSuccess( { data: null, status: 'missing' } );
          }
          const [ shelfProducts, shelfCompliance ] = await Promise.all( [
            planoMappingService.count( { shelfId: shelf.toObject()._id } ),
            planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
          ] );

          return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
            isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
        }


        const misplacedProductShelf = await fixtureShelfService.findOne( { _id: misplacedProductMapping.toObject().shelfId } );

        let misplacedProductDetails = await planoProductService.findOne( { _id: misplacedProductMapping.toObject().productId } );

        if ( shelf.toObject().sectionName === misplacedProductShelf.toObject().sectionName ) {
          const complianceData = { ...misplacedProductMapping.toObject(), planoMappingId: misplacedProductMapping.toObject()._id, compliance: 'proper' };
          delete complianceData._id;

          await planoComplianceService.updateOne( { ...misplacedQuery, date: currentDate }, complianceData );

          const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
            planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
          ] );

          const fixtureMetrics = {
            total: totalProducts,
            scanned: scannedProducts,
            misplaced: misplacedProducts,
            proper: properProducts,
            missing: missingProducts,
          };


          const [ shelfProducts, shelfCompliance ] = await Promise.all( [
            planoMappingService.count( { shelfId: misplacedProductMapping.toObject().shelfId } ),
            planoComplianceService.count( { date: currentDate, shelfId: misplacedProductMapping.toObject().shelfId, compliance: 'proper' } ),
          ] );

          const shelfMetrics = {
            shelfId: misplacedProductMapping.toObject().shelfId,
            isScanned: shelfCompliance >= shelfProducts/2 ? true : false };

          return res.sendSuccess( { data: { ...misplacedProductMapping.toObject(), ...( misplacedProductDetails ? misplacedProductDetails?.toObject() : {} ) },
            fixtureMetrics: fixtureMetrics, shelfMetrics: shelfMetrics, status: 'proper' } );
        } else {
          return res.sendError( 'RFID conflict with section', 400 );
        }
      }


      const complianceData = { ...productMapping.toObject(), compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, planoMappingId: productMapping.toObject()._id, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        proper: properProducts,
        missing: missingProducts,
      };

      const [ shelfProducts, shelfCompliance ] = await Promise.all( [
        planoMappingService.count( { shelfId: productMapping.toObject().shelfId } ),
        planoComplianceService.count( { date: currentDate, shelfId: productMapping.toObject().shelfId, compliance: 'proper' } ),
      ] );

      const shelfMetrics = {
        shelfId: productMapping.toObject().shelfId,
        isScanned: shelfCompliance >= shelfProducts/2 ? true : false };

      return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, shelfMetrics: shelfMetrics, status: 'proper' } );
    } else if ( fixture.productResolutionLevel === 'L4' ) {
      if ( !req.body.shelfId && req.body.rfId ) {
        const shelf = await fixtureShelfService.findOne( { planoId: req.body.planoId, floorId: req.body.floorId, fixtureId: req.body.fixtureId, rfId: req.body.rfId } );
        if ( !shelf ) return res.sendError( 'No matching shelf for the rfId', 400 );
        const [ shelfProducts, shelfCompliance ] = await Promise.all( [
          planoMappingService.count( { shelfId: shelf.toObject()._id } ),
          planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
        ] );
        return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
          isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
      }

      if ( !req.body.shelfId ) return res.sendError( 'Shelf id is required', 400 );

      if ( !req.body.shelfPosition ) return res.sendError( 'Shelf position is required', 400 );

      const mappingQuery = {
        planoId: req.body.planoId,
        floorId: req.body.floorId,
        fixtureId: req.body.fixtureId,
        shelfId: req.body.shelfId,
        shelfPosition: req.body.shelfPosition,
      };

      const productMapping = await planoMappingService.findOne( mappingQuery );

      if ( !productMapping ) {
        const shelf = await fixtureShelfService.findOne( mappingQuery );
        if ( !shelf ) {
          return res.sendSuccess( { data: null, status: 'missing' } );
        }
        const [ shelfProducts, shelfCompliance ] = await Promise.all( [
          planoMappingService.count( { shelfId: shelf.toObject()._id } ),
          planoComplianceService.count( { date: currentDate, shelfId: shelf.toObject()._id, compliance: 'proper' } ),
        ] );
        return res.sendSuccess( { shelfId: shelf.toObject()._id, shelfNumber: shelf.toObject().shelfNumber,
          isScanned: shelfCompliance >= shelfProducts/2 ? true : false } );
      }

      if ( productMapping.toObject().rfId !== req.body.rfId ) {
        const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'misplaced' };
        delete complianceData._id;

        let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

        const isComplianceProper = await planoComplianceService.count( { ...mappingQuery, date: currentDate, compliance: 'proper' } );

        if ( !isComplianceProper ) {
          await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );
        }


        const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          proper: properProducts,
          missing: missingProducts,
        };

        return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        proper: properProducts,
        missing: missingProducts,
      };

      const [ shelfProducts, shelfCompliance ] = await Promise.all( [
        planoMappingService.count( { shelfId: productMapping.toObject().shelfId } ),
        planoComplianceService.count( { date: currentDate, shelfId: productMapping.toObject().shelfId, compliance: 'proper' } ),
      ] );

      const shelfMetrics = {
        shelfId: productMapping.toObject().shelfId,
        isScanned: shelfCompliance >= shelfProducts/2 ? true : false };

      return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, shelfMetrics: shelfMetrics, status: 'proper' } );
    } else {
      return res.sendError( 'Incorrect resolution level', 400 );
    }
  } catch ( e ) {
    logger.error( { functionName: 'scanv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function updateMissing( req, res ) {
  try {
    const { planoId, fixtureId } = req.body;

    const [ planogram, fixture ] = await Promise.all( [
      planoService.findOne(
          { _id: new mongoose.Types.ObjectId( planoId ) },
          { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
      ),
      storeFixtureService.findOne( {
        _id: new mongoose.Types.ObjectId( fixtureId ),
      } ),
    ] );

    if ( !planogram ) return res.sendError( 'Planogram not found', 204 );
    if ( !fixture ) return res.sendError( 'Fixture not found', 204 );

    const fixtureShelves = await fixtureShelfService.find( {
      fixtureId: new mongoose.Types.ObjectId( fixtureId ),
    } );

    if ( !fixtureShelves.length ) return res.sendError( 'No shelves found for the fixture', 204 );

    await Promise.all(
        fixtureShelves.map( async ( shelf ) => {
          const productMappings = await planoMappingService.find( { shelfId: shelf._id } );

          if ( !productMappings.length ) {
            return { ...shelf.toObject(), products: [] };
          }

          const productIds = productMappings.map( ( mapping ) => mapping.productId );
          const products = await planoProductService.find( { _id: { $in: productIds } } );
          const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );

          const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

          await Promise.all(
              productMappings.map( async ( mapping ) => {
                const productData = productMap.get( mapping.productId.toString() );
                if ( !productData ) {
                  return { ...mapping.toObject(), status: '' };
                }

                const mappingCompliance = await planoComplianceService.findOne( {
                  planoMappingId: mapping._id,
                  date: currentDate,
                } );

                if ( !mappingCompliance ) {
                  delete mapping.toObject()._id;
                  planoComplianceService.create( { ...mapping.toObject(), planoMappingId: mapping._id, compliance: 'missing', date: currentDate } );
                }

                return {
                  ...mapping.toObject(),
                  ...productData,
                };
              } ),
          );


          return {
            ...shelf.toObject(),
          };
        } ),
    );

    return res.sendSuccess( 'Updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureShelfProductv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function bulkFixtureUpload( req, res ) {
  try {
    const fixture = await storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( req.body.id ) } );

    console.log( fixture );

    const fixtureDoc = fixture.toObject();

    for ( let i = 0; i < req.body.data.length; i++ ) {
      const shelfData = {
        'clientId': fixtureDoc.clientId,
        'storeName': fixtureDoc.storeName,
        'storeId': fixtureDoc.storeId,
        'planoId': fixtureDoc.planoId,
        'floorId': fixtureDoc.floorId,
        'fixtureId': fixtureDoc._id,
        'shelfNumber': i+1,
        'shelfOrder': 'LTR',
        'shelfCapacity': 2,
        'shelfType': 'middle',
        'sectionName': req.body.data[i].sectionName,
        'sectionZone': req.body.data[i]?.sectionZone,
        // 'rfId':req.body.data[i].sectionName
      };

      const createdShelf = await fixtureShelfService.create( shelfData );

      for ( let j = 0; j < req.body.data[i].products.length; j++ ) {
        const product = await planoProductService.findOne( { itemcode: req.body.data[i].products[j].rfId } );

        const productMapping = {
          'clientId': fixtureDoc.clientId,
          'storeName': fixtureDoc.storeName,
          'storeId': fixtureDoc.storeId,
          'type': 'product',
          'planoId': fixtureDoc.planoId,
          'floorId': fixtureDoc.floorId,
          'fixtureId': fixtureDoc._id,
          'shelfId': createdShelf._id,
          'shelfPosition': j+1,
          'productId': product ? product.toObject()._id : undefined,
          'rfId': req.body.data[i].products[j].rfId,
          'category': 'middle',
        };
        await planoMappingService.create( productMapping );
        console.log( j );
      }
    }

    const productMappings = await planoMappingService.find( { fixtureId: req.body.id } );


    for ( let i = 0; i < productMappings.length; i++ ) {
      const mapping = productMappings[i].toObject();

      const product = await planoProductService.findOne( { productId: mapping.rfId } );

      if ( product ) {
        await planoMappingService.updateOne( { _id: mapping._id }, { productId: product.toObject()._id } );
      }

      console.log( product );
    }

    res.sendSuccess( fixture );
  } catch ( e ) {
    logger.error( { functionName: 'bulkAdd', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export const uploadImage = async ( req, res ) => {
  try {
    let imgUrl;
    if ( typeof req.files.file == 'undefined' ) {
      return res.sendError( { message: 'Please Upload a file' }, 400 );
    }
    req.files.file.name = req.files.file.name.replace( /\s/g, '' );
    let imageFormat = req.files.file.name.split( '.' )[1];

    let bucket = JSON.parse( process.env.BUCKET );

    let params = {
      fileName: `/${req.body.fixtureId}.${imageFormat}`,
      Key: `staticFixtureImages`,
      Bucket: bucket.storeBuilder,
      ContentType: req.files.file.mimetype,
      body: req.files.file.data,
    };
    imgUrl = await fileUpload( params );

    let inputData = {
      Bucket: bucket.storeBuilder,
      file_path: imgUrl.Key,
    };
    imgUrl = await signedUrl( inputData );
    if ( !imgUrl ) {
      return res.sendError( { message: 'Something went Wrong' }, 500 );
    }

    return res.sendSuccess( { message: 'Uploaded Successfully', imgUrl: imgUrl } );
  } catch ( e ) {
    logger.error( 'uploadImage =>', e );
    return res.sendError( e, 500 );
  }
};

export async function storeFixturesTask( req, res ) {
  try {
    const planoIds = req.body.id
        .filter( ( id ) => mongoose.Types.ObjectId.isValid( id ) )
        .map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        {
          $or: [
            { _id: { $in: planoIds } },
            { storeId: { $in: req.body.id } },
          ],
        },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1, scanType: 1, validateShelfSections: 1 },
    );

    if ( !planograms?.length ) return res.sendError( 'No data found', 204 );


    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floors = await storeBuilderService.find(
              { planoId: planogram._id },
              { floorName: 1, layoutPolygon: 1, planoId: 1 },
          );

          const floorsWithFixtures = await Promise.all(
              floors.map( async ( floor ) => {
                let productCapacity = 0;
                let fixtureCount = 0;
                const layoutPolygonWithFixtures = await Promise.all(
                    floor.layoutPolygon.map( async ( element ) => {
                      const fixtures = await storeFixtureService.findAndSort( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'wall',
                      }, { shelfcount: 0 }, { fixtureNumber: 1 } );

                      const fixturesWithStatus = await Promise.all(
                          fixtures.map( async ( fixture ) => {
                            if ( fixture?.imageUrl || fixture.vmImageUrl ) {
                              let params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: req.body.type == 'vm' ? fixture.vmImageUrl : fixture.imageUrl,
                              };
                              fixture.imageUrl = await signedUrl( params );
                            } else {
                              fixture.imageUrl = '';
                            }
                            productCapacity += fixture.toObject().fixtureCapacity;
                            fixtureCount += 1;
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                            const compliance = await planoTaskComplianceService.findOne( {
                              fixtureId: fixture._id,
                              type: req.body?.type ? req.body.type : 'fixture',
                              date_string: req.body?.date,
                            }, { status: 1 } );

                            const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                            const shelfDetails = await Promise.all(
                                shelves.map( async ( shelf ) => {
                                  const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                                  const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                                  return {
                                    ...shelf.toObject(),
                                    productCount: productCount,
                                    vmCount: vmCount,
                                  };
                                } ),
                            );

                            const vms = await planoMappingService.find( { fixtureId: fixture._id, type: 'vm' } );

                            const vmDetails = await Promise.all( vms.map( async ( vm ) => {
                              const vmTemplate = await planoProductService.findOne( { _id: vm.toObject().productId } );
                              const params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: vmTemplate?.productImageUrl,
                              };
                              const vmImage = await signedUrl( params );
                              return {
                                ...vm.toObject(),
                                ...vmTemplate?.toObject(),
                                ...( typeof vmImage === 'string' && { productImageUrl: vmImage } ),

                              };
                            } ) );

                            return {
                              ...fixture.toObject(),
                              status: compliance?.status ? compliance.status : '',
                              shelfCount: shelves.length,
                              productCount: productCount,
                              vmCount: vmCount,
                              shelfDetails: shelfDetails,
                              vms: vmDetails,
                            };
                          } ),
                      );

                      const otherElements = await storeFixtureService.find( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'other',
                      } );

                      return {
                        ...element,
                        fixtures: fixturesWithStatus,
                        otherElements: otherElements,
                      };
                    } ),
                );

                const centerFixtures = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'floor',
                } );

                const centerFixturesWithStatus = await Promise.all(
                    centerFixtures.map( async ( fixture ) => {
                      if ( fixture?.imageUrl || fixture.vmImageUrl ) {
                        let params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: req.body.type == 'vm' ? fixture.vmImageUrl : fixture.imageUrl,
                        };
                        fixture.imageUrl = await signedUrl( params );
                      } else {
                        fixture.imageUrl = '';
                      }
                      productCapacity += fixture.toObject().fixtureCapacity;
                      fixtureCount += 1;
                      const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                      const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                      const compliance = await planoTaskComplianceService.findOne( {
                        fixtureId: fixture._id,
                        type: req.body?.type ? req.body.type : 'fixture',
                        date_string: req.body?.date,
                      }, { status: 1 } );

                      const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                      const shelfDetails = await Promise.all(
                          shelves.map( async ( shelf ) => {
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                            return {
                              ...shelf.toObject(),
                              productCount: productCount,
                              vmCount: vmCount,
                            };
                          } ),
                      );

                      const vms = await planoMappingService.find( { fixtureId: fixture._id, type: 'vm' } );

                      const vmDetails = await Promise.all( vms.map( async ( vm ) => {
                        const vmTemplate = await planoProductService.findOne( { _id: vm.toObject().productId } );

                        const params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: vmTemplate?.productImageUrl,
                        };
                        const vmImage = await signedUrl( params );
                        return {
                          ...vm.toObject(),
                          ...vmTemplate?.toObject(),
                          ...( typeof vmImage === 'string' && { productImageUrl: vmImage } ),

                        };
                      } ) );

                      return {
                        ...fixture.toObject(),
                        status: compliance?.status ? compliance.status : '',
                        shelfCount: shelves.shelves,
                        productCount: productCount,
                        vmCount: vmCount,
                        shelfDetails: shelfDetails,
                        vms: vmDetails,
                      };
                    } ),
                );

                // const productCount = await planoMappingService.count( { floorId: floor._id } );

                const otherElements = await storeFixtureService.find( {
                  floorId: floor._id,
                  associatedElementType: { $exists: false },
                  associatedElementNumber: { $exists: false },
                  fixtureType: 'other',
                } );

                return {
                  ...floor.toObject(),
                  layoutPolygon: layoutPolygonWithFixtures,
                  centerFixture: centerFixturesWithStatus,
                  productCount: productCapacity,
                  fixtureCount: fixtureCount,
                  // productCapacity: productCapacity,
                  otherElements: otherElements,
                };
              } ),
          );

          return {
            ...planogram.toObject(),
            floors: floorsWithFixtures,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeFixturesTask', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export const qrFileUpload = async ( req, res ) => {
  try {
    if ( !req.files?.file ) {
      return res.sendError( { message: 'Please upload a file' }, 400 );
    }

    const { file } = req.files;
    const { fixtureId, type } = req.body;

    if ( !fixtureId ) {
      return res.sendError( { message: 'Missing fixtureId' }, 400 );
    }

    const fixture = await storeFixtureService.findOne( { _id: fixtureId } );

    if ( !fixture ) {
      return res.sendError( { message: 'Fixture not found' }, 400 );
    }

    const format = path.extname( file.name ).toLowerCase().replace( '.', '' );
    file.name = file.name.replace( /\s/g, '' );

    const bucket = JSON.parse( process.env.BUCKET || '{}' );
    if ( !bucket.storeBuilder ) {
      return res.sendError( { message: 'Storage bucket not configured' }, 500 );
    }

    let uploadPath;

    if ( type === 'video' ) {
      uploadPath = `planoQrFixtureVideos/${dayjs().format( 'YYYY-MM-DD' )}/${fixture.toObject().storeId}`;
    } else if ( type === 'image' ) {
      uploadPath = `planoQrFixtureImages/${dayjs().format( 'YYYY-MM-DD' )}/${fixture.toObject().storeId}`;
    }

    const params = {
      fileName: `/${fixtureId}.${format}`,
      Key: uploadPath,
      Bucket: bucket.storeBuilder,
      ContentType: file.mimetype,
      body: file.data,
    };

    const fileUrl = await fileUpload( params );

    const signedParams = {
      Bucket: bucket.storeBuilder,
      file_path: fileUrl.Key,
    };
    const signedKey = await signedUrl( signedParams );

    res.sendSuccess( signedKey );
  } catch ( error ) {
    logger.error( 'fixtureQrUpdate =>', error );
    return res.sendError( { message: 'Internal Server Error' }, 500 );
  }
};

export const updateQrCvProcessRequest = async ( req, res ) => {
  try {
    const { fixtureId, videoPath, imagePath, videoComment, imageComment } = req.body;

    if ( !fixtureId ) {
      return res.sendError( { message: 'Missing fixtureId' }, 400 );
    }

    const fixture = await storeFixtureService.findOne( { _id: fixtureId } );

    if ( !fixture ) {
      return res.sendError( { message: 'Fixture not found' }, 400 );
    }

    const bucket = JSON.parse( process.env.BUCKET || '{}' );
    if ( !bucket.storeBuilder ) {
      return res.sendError( { message: 'Storage bucket not configured' }, 500 );
    }

    const message = {
      'fixtureId': fixtureId,
      'date': dayjs().format( 'YYYY-MM-DD' ),
      'bucket': bucket.storeBuilder,
      'videoPath': videoPath ? videoPath.match( /planoQrFixtureVideos\/[^?]+/ )?.[0] : undefined,
    };

    const sqs = JSON.parse( process.env.SQS || '{}' );
    if ( !sqs.url || !sqs.qrVideoTopic ) {
      return res.sendError( { message: 'SQS details not configured' }, 500 );
    }

    const sqsPush = await sendMessageToQueue( `${sqs.url}${sqs.qrVideoTopic}`, JSON.stringify( message ) );

    if ( !sqsPush?.MessageId ) {
      return res.sendError( { message: 'Failed to send SQS message' }, 500 );
    }

    const fixtureData = fixture.toObject();

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const data = {
      clientId: fixtureData?.clientId,
      storeName: fixtureData?.storeName,
      storeId: fixtureData?.storeId,
      planoId: fixtureData?.planoId,
      floorId: fixtureData?.floorId,
      fixtureId: fixtureData?._id,
      date: currentDate,
      status: 'initiated',
      fixtureImage: {
        filePath: imagePath ? imagePath.match( /planoQrFixtureImages\/[^?]+/ )?.[0] : undefined,
        comment: imageComment,
      },
      fixtureVideo: {
        filePath: videoPath ? videoPath.match( /planoQrFixtureVideos\/[^?]+/ )?.[0] : undefined,
        comment: videoComment,
      },
    };

    await planoQrConversionRequestService.upsertOne( { fixtureId: fixtureData?._id, date: currentDate }, data );

    return res.sendSuccess( { message: 'Updated successfully', data } );
  } catch ( error ) {
    logger.error( 'uploadFixtureVideo =>', error );
    return res.sendError( { message: 'Internal Server Error' }, 500 );
  }
};

export const getQrCvProcessRequest = async ( req, res ) => {
  try {
    const { fixtureId } = req.body;

    if ( !fixtureId ) {
      return res.sendError( { message: 'Missing fixtureId' }, 400 );
    }

    const fixture = await storeFixtureService.findOne( { _id: fixtureId } );

    if ( !fixture ) {
      return res.sendError( { message: 'Fixture not found' }, 400 );
    }

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const planoCvReq = await planoQrConversionRequestService.findOne( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), date: currentDate } );

    if ( !planoCvReq ) {
      return res.sendError( 'No data found', 204 );
    }

    const bucket = JSON.parse( process.env.BUCKET || '{}' );
    if ( !bucket.storeBuilder ) {
      return res.sendError( { message: 'Storage bucket not configured' }, 500 );
    }

    let planoCvReqData = planoCvReq.toObject();

    if ( planoCvReqData?.fixtureImage?.filePath ) {
      const params = {
        Bucket: bucket.storeBuilder,
        file_path: planoCvReqData.fixtureImage.filePath,
      };
      planoCvReqData.fixtureImage.filePath = await signedUrl( params );
    }

    if ( planoCvReqData?.fixtureVideo?.filePath ) {
      const params = {
        Bucket: bucket.storeBuilder,
        file_path: planoCvReqData.fixtureVideo.filePath,
      };
      planoCvReqData.fixtureVideo.filePath = await signedUrl( params );
    }

    return res.sendSuccess( planoCvReqData );
  } catch ( error ) {
    logger.error( 'uploadFixtureVideo =>', error );
    return res.sendError( { message: 'Internal Server Error' }, 500 );
  }
};

export const fixtureQrUpdate = async ( req, res ) => {
  try {
    const { fixtureId, date, productQr } = req.body;

    const fixture = await storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( fixtureId ) }, { _id: 1 } );

    if ( !fixture ) {
      return res.sendError( { message: 'Invalid fixture Id' }, 400 );
    }

    const productMappings = await planoMappingService.find( { fixtureId: fixture.toObject()._id, type: 'product' } );

    if ( !productMappings.length ) {
      return res.sendError( { message: 'No mapping found for fixture' }, 400 );
    }

    const currentDate = new Date( date );

    const updateStatus = await Promise.all(
        productMappings.map( async ( mapping ) => {
          const mappingData = mapping.toObject();

          if ( productQr.includes( mappingData.rfId ) ) {
            const complianceData = { ...mappingData, planoMappingId: mappingData._id, compliance: 'proper' };

            delete complianceData._id;

            await planoComplianceService.updateOne( { fixtureId: fixture.toObject()._id, rfId: mappingData.rfId, date: currentDate }, complianceData );

            return {
              result: 'proper',
              id: mappingData.rfId,
            };
          } else {
            const complianceData = { ...mappingData, planoMappingId: mappingData._id, compliance: 'missing' };

            delete complianceData._id;

            await planoComplianceService.updateOne( { fixtureId: fixture.toObject()._id, rfId: mappingData.rfId, date: currentDate }, complianceData );

            return {
              result: 'missing',
              id: mappingData.rfId,
            };
          }
        } ),
    );

    await planoQrConversionRequestService.updateOne( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), date: currentDate }, { status: 'data-received', receivedQr: productQr } );

    return res.sendSuccess( updateStatus );
  } catch ( error ) {
    logger.error( 'fixtureQrUpdate =>', error );
    return res.sendError( { message: 'Internal Server Error' }, 500 );
  }
};

export const fixtureQrUpdatev1 = async ( req, res ) => {
  try {
    const { fixtureId, date, productQr } = req.body;

    const fixture = await storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( fixtureId ) }, { _id: 1 } );

    if ( !fixture ) {
      return res.sendError( { message: 'Invalid fixture Id' }, 400 );
    }

    const fixtureShelves = await fixtureShelfService.find( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) } );

    let productIndex = 0;

    const complianceData = fixtureShelves.map( ( shelf ) => {
      const shelfObj = shelf.toObject();
      const products = shelfObj.shelfCapacity ?
        Array.from( { length: shelfObj.shelfCapacity }, () => ( {
          category: shelfObj.sectionName,
          productIndex: productIndex++,
          status: 'missing',
        } ) ) :
        [];

      return { ...shelfObj, products };
    } );

    const productMap = new Map();
    productQr.forEach( ( productCv, i ) => {
      if ( productCv.parent_brand ) {
        productMap.set( i, productCv );
      }
    } );

    complianceData.forEach( ( shelf ) => {
      shelf.products.forEach( ( product ) => {
        const matchedProduct = productMap.get( product.productIndex );
        if ( matchedProduct && product.category === matchedProduct.parent_brand ) {
          Object.assign( product, { status: 'proper', barcode: matchedProduct.barcode } );
        }
      } );
    } );

    const currentDate = new Date( date );

    await planoQrConversionRequestService.updateOne( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), date: currentDate }, { status: 'data-received', receivedQr: productQr, processedData: complianceData } );

    res.sendSuccess( complianceData );
  } catch ( error ) {
    logger.error( 'fixtureQrUpdate =>', error );
    return res.sendError( { message: 'Internal Server Error' }, 500 );
  }
};


export const updateDetailedDistance = async ( req, res ) => {
  try {
    const { floorId, elementNumber, elementType, detailedDistance } = req.body;

    if ( !floorId || elementNumber === undefined || !elementType || detailedDistance === undefined ) {
      return res.sendError( 'Missing required fields', 400 );
    }

    const floorData = await storeBuilderService.findOne( { '_id': new mongoose.Types.ObjectId( floorId ) } );

    const layoutPolygon = floorData.toObject().layoutPolygon.map( ( element ) => {
      if ( element.elementType === elementType && element.elementNumber === elementNumber ) {
        return {
          ...element,
          detailedDistance: detailedDistance,
        };
      } else {
        return { ...element };
      }
    } );

    const updateFloor = await storeBuilderService.updateOne( { '_id': new mongoose.Types.ObjectId( floorId ) }, { layoutPolygon: layoutPolygon } );


    if ( !updateFloor.modifiedCount ) {
      return res.sendError( 'Floor layout or element not found', 400 );
    }

    return res.sendSuccess( { message: 'Detailed distance updated successfully', updateFloor } );
  } catch ( error ) {
    logger.error( 'updateDetailedDistance =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export const upsertFixtures = async ( req, res ) => {
  try {
    const { fixtureId, planoId, floorId, data } = req.body;

    if ( !planoId || !floorId || !data ) {
      return res.sendError( 'Missing required fields', 400 );
    }

    const updateData = {
      planoId: new mongoose.Types.ObjectId( planoId ),
      floorId: new mongoose.Types.ObjectId( floorId ),
      ...data,
    };

    let fixture;
    if ( fixtureId ) {
      fixture = await storeFixtureService.findOneAndUpdate(
          { _id: fixtureId },
          { $set: updateData },
          { new: true, upsert: true },
      );
    } else {
      fixture = await storeFixtureService.create( updateData );
    }

    return res.sendSuccess( { message: 'Fixture upserted successfully', fixture } );
  } catch ( error ) {
    logger.error( 'upsertFixtures =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export const getShelfSections = async ( req, res ) => {
  try {
    const pipeline = [
      {
        '$match': {
          'clientId': req.body.clientId,
        },
      },
      {
        $project:
          {
            sectionName: 1,
            sectionZone: 1,
          },
      },
      {
        '$match': {
          'sectionName': { '$ne': null },
        },
      },
      {
        $group: {
          _id: '$sectionName',
        },
      },
      {
        $group: {
          '_id': null,
          'sectionNames': { '$push': '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          sectionNames: 1,
        },
      },
    ];

    const sections = await fixtureShelfService.aggregate( pipeline );

    if ( !sections.length ) {
      return res.sendError( 'No data found', 204 );
    }

    const [ data ] = sections;

    const resData = [
      ...data?.sectionNames,
      'NA',
    ];

    return res.sendSuccess( resData );
  } catch ( error ) {
    logger.error( 'getShelfSections =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export const getFixtureTypes = async ( req, res ) => {
  try {
    const pipeline = [
      {
        '$match': {
          'clientId': req.body.clientId,
        },
      },
      {
        $project:
          {
            fixtureCategory: 1,
            fixtureLength: 1,
          },
      },
      {
        '$match': {
          'fixtureCategory': { '$ne': null },
        },
      },
      {
        $group: {
          _id: '$fixtureCategory',
          fixtureLength: { $first: '$fixtureLength' },
        },
      },
      {
        $group: {
          '_id': null,
          'fixtureCategoryFt': { '$push': { $concat: [ '$_id', '-', { $toString: '$fixtureLength.value' }, '$fixtureLength.unit' ] } },
          'fixtureCategory': { '$push': '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          fixtureCategory: 1,
        },
      },
    ];

    const sections = await fixtureConfigService.aggregate( pipeline );

    if ( !sections.length ) {
      return res.sendError( 'No data found', 204 );
    }

    const [ data ] = sections;

    return res.sendSuccess( data?.fixtureCategory );
  } catch ( error ) {
    logger.error( 'getFixtureTypes =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export const getFixtureLengths = async ( req, res ) => {
  try {
    const pipeline = [
      {
        '$match': {
          'clientId': req.body.clientId,
        },
      },
      {
        $project:
          {
            fixtureLength: 1,
          },
      },
      {
        '$match': {
          '$and': [
            { 'fixtureLength': { '$ne': null } },
            { 'fixtureLength.value': { '$ne': 0 } },
          ]
          ,
        },
      },
      {
        $group: {
          _id: '$fixtureLength',
        },
      },
      {
        $group: {
          '_id': null,
          'fixtureLength': { '$push': '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          fixtureLength: 1,
        },
      },
    ];

    const sections = await fixtureConfigService.aggregate( pipeline );

    if ( !sections.length ) {
      return res.sendError( 'No data found', 204 );
    }

    const [ data ] = sections;

    return res.sendSuccess( data?.fixtureLength );
  } catch ( error ) {
    logger.error( 'getFixtureLengths =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};


export const getFixtureBrands = async ( req, res ) => {
  try {
    // const pipeline = [
    //   {
    //     '$match': {
    //       'clientId': req.body.clientId,
    //     },
    //   },
    //   {
    //     $project:
    //       {
    //         fixtureBrandCategory: 1,
    //       },
    //   },
    //   {
    //     '$match': {
    //       '$and': [
    //         { 'fixtureBrandCategory': { '$ne': null } },
    //         { 'fixtureBrandCategory': { '$ne': '' } },
    //         { 'fixtureBrandCategory': { '$ne': 'nil' } },
    //         { 'fixtureBrandCategory': { '$not': { '$type': 'array' } } },
    //       ],
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$fixtureBrandCategory',
    //     },
    //   },
    //   {
    //     $group: {
    //       '_id': null,
    //       'fixtureBrandCategory': { '$push': '$_id' },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       fixtureBrandCategory: 1,
    //     },
    //   },
    // ];

    // const sections = await storeFixtureService.aggregate( pipeline );

    // if ( !sections.length ) {
    //   return res.sendError( 'No data found', 204 );
    // }

    // const [ data ] = sections;

    const brandCategories = await planoStaticData.findOne( { type: 'brandCategory' } );

    return res.sendSuccess( brandCategories.toObject().data );
  } catch ( error ) {
    logger.error( 'getFixtureBrands =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export const checkPlanoExist = async ( req, res ) => {
  try {
    const plano = await planoService.findOne( { storeName: req.body.store } );

    if ( plano ) {
      return res.sendSuccess( true );
    } else {
      return res.sendSuccess( false );
    }
  } catch ( error ) {
    logger.error( 'getFixtureBrands =>', error );
    return res.sendError( 'Internal Server Error', 500 );
  }
};

export async function storeLayoutElements( req, res ) {
  try {
    // const planoIds = req.body.id.map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        { _id: new mongoose.Types.ObjectId( req.body.id ) },
        { storeId: 1, storeName: 1, planoId: '$_id' },
    );

    if ( !planograms?.length ) {
      return res.sendError( 'No data found', 204 );
    }

    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floorList = await storeBuilderService.find(
              { planoId: planogram._id },
              { floorName: 1, layoutPolygon: 1, crestLayout: 1 },
          );

          const floors = floorList.map( ( floor ) => {
            if ( floor.toObject()?.crestLayout ) {
              return {
                floorName: 'floor 1',
                layoutPolygon: [ 'wall 1', 'wall 2', 'wall 3', 'centre' ],
              };
            } else {
              const layoutPolygon = floor
                  .toObject()
                  ?.layoutPolygon.map( ( element ) => {
                    return `${element?.elementType} ${element?.elementNumber}`;
                  } );
              layoutPolygon.push( 'centre' );
              return {
                ...floor.toObject(),
                layoutPolygon,
              };
            }
          } );

          return {
            ...planogram.toObject(),
            floors,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeLayoutv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function qrScan( req, res ) {
  try {
    if ( !req.body.floorId ) return res.sendError( 'Floor id is required', 400 );

    if ( !req.body.fixtureId ) return res.sendError( 'Fixture id is required', 400 );

    if ( !req.body.rfId ) return res.sendError( 'RFID is required', 400 );
    const fixture = await storeFixtureService.findOne(
        { _id: new mongoose.Types.ObjectId( req.body.fixtureId ) },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
    );

    if ( !fixture ) return res.sendError( 'No data found', 204 );

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    async function getFixtureMetrics( fixture, currentDate ) {
      const [ totalProducts, scannedProducts, misplacedProducts, properProducts, missingProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'missing' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        proper: properProducts,
        missing: missingProducts,
      };

      return fixtureMetrics;
    }


    if ( fixture.productResolutionLevel === 'L1' ) {
      const mappingQuery = {
        planoId: req.body.planoId,
        floorId: req.body.floorId,
        fixtureId: req.body.fixtureId,
        rfId: req.body.rfId,
      };

      const productMapping = await planoMappingService.findOne( mappingQuery );

      if ( !productMapping ) {
        const misplacedQuery = {
          planoId: req.body.planoId,
          floorId: req.body.floorId,
          rfId: req.body.rfId,
        };
        const misplacedProductMapping = await planoMappingService.findOne( misplacedQuery );

        if ( !misplacedProductMapping ) {
          return res.sendSuccess( { data: null, status: 'missing' } );
        }

        const complianceData = { ...misplacedProductMapping.toObject(), planoMappingId: misplacedProductMapping.toObject()._id, compliance: 'misplaced' };
        delete complianceData._id;


        await planoComplianceService.updateOne( { ...misplacedQuery, date: currentDate }, complianceData );

        const fm = await getFixtureMetrics( fixture, currentDate );

        return res.sendSuccess( { data: { ...misplacedProductMapping.toObject() }, fixtureMetrics: fm, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const fm = await getFixtureMetrics( fixture, currentDate );


      return res.sendSuccess( { data: { ...productMapping.toObject() }, fixtureMetrics: fm, status: 'proper' } );
    } else if ( fixture.productResolutionLevel === 'L3' ) {
      const sectionShelves = await fixtureShelfService.find( { fixtureId: fixture._id, sectionName: req.body.sectionName } );

      if ( !sectionShelves.length ) return res.sendError( 'No shelves found for the Section', 400 );

      const shelfIds = sectionShelves.map( ( shelf ) => shelf.toObject()._id );

      const planoMapping = await planoMappingService.findOne( { rfId: req.body.rfId, shelfId: { $in: shelfIds } } );

      if ( !planoMapping ) {
        const locatePlano = await planoMappingService.findOne( { rfId: req.body.rfId, floorId: req.body.floorId } );

        if ( !locatePlano ) {
          return res.sendSuccess( { data: null, fixtureMetrics: null, status: 'missing' } );
        }

        const locatePlanoData = locatePlano.toObject();

        delete locatePlanoData._id;

        const complianceData = { ...locatePlanoData, planoMappingId: locatePlano.toObject()._id, compliance: 'misplaced' };

        await planoComplianceService.updateOne( { date: currentDate, planoMappingId: locatePlano.toObject()._id }, complianceData );


        const fm = await getFixtureMetrics( fixture, currentDate );


        return res.sendSuccess( { data: { ...locatePlano.toObject() }, fixtureMetrics: fm, status: 'misplaced' } );
      }

      const mapingData = planoMapping.toObject();

      delete mapingData._id;

      const complianceData = { ...mapingData, planoMappingId: planoMapping.toObject()._id, compliance: 'proper' };

      await planoComplianceService.updateOne( { date: currentDate, planoMappingId: planoMapping.toObject()._id }, complianceData );

      const fm = await getFixtureMetrics( fixture, currentDate );

      return res.sendSuccess( { data: { ...planoMapping.toObject() }, fixtureMetrics: fm, status: 'proper' } );
    } else {
      return res.sendError( 'Incorrect resolution level', 400 );
    }
  } catch ( e ) {
    logger.error( { functionName: 'scanv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeFixturesv2( req, res ) {
  try {
    const planoIds = req.body.id
        .filter( ( id ) => mongoose.Types.ObjectId.isValid( id ) )
        .map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        {
          $or: [
            { _id: { $in: planoIds } },
            { storeId: { $in: req.body.id } },
          ],
        },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1, scanType: 1, clientId: 1, validateShelfSections: 1 },
    );

    if ( !planograms?.length ) return res.sendError( 'No data found', 204 );

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floors = await storeBuilderService.find(
              { planoId: planogram._id },
              { floorName: 1, layoutPolygon: 1, planoId: 1 },
          );

          const floorsWithFixtures = await Promise.all(
              floors.map( async ( floor ) => {
                let productCapacity = 0;
                const layoutPolygonWithFixtures = await Promise.all(
                    floor.layoutPolygon.map( async ( element ) => {
                      const fixtures = await storeFixtureService.findAndSort( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'wall',
                      }, { shelfcount: 0 }, { fixtureNumber: 1 } );

                      const fixturesWithStatus = await Promise.all(
                          fixtures.map( async ( fixture ) => {
                            if ( fixture?.imageUrl ) {
                              let params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: fixture.imageUrl,
                              };
                              fixture.imageUrl = await signedUrl( params );
                            } else {
                              fixture.imageUrl = '';
                            }
                            productCapacity += fixture.toObject().fixtureCapacity;
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                            const complianceCount = await planoComplianceService.count( {
                              fixtureId: fixture._id,
                              compliance: 'proper',
                              date: currentDate,
                            } );

                            const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { }, { shelfNumber: 1 } );

                            const shelfDetails = await Promise.all(
                                shelves.map( async ( shelf ) => {
                                  const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                                  const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                                  return {
                                    ...shelf.toObject(),
                                    productCount: productCount,
                                    vmCount: vmCount,
                                  };
                                } ),
                            );

                            let fixtureStatus;

                            const cvProcessStatus = await planoQrConversionRequestService.count( { fixtureId: fixture._id, date: currentDate, status: 'initiated' } );

                            if ( cvProcessStatus ) {
                              fixtureStatus = 'inprogress';
                            } else {
                              const missingCount = await planoComplianceService.count( {
                                fixtureId: fixture._id,
                                compliance: 'missing',
                                date: currentDate,
                              } );
                              fixtureStatus = complianceCount === 0 && !missingCount ? '' : complianceCount === productCount ? 'complete' : 'incomplete';
                            }


                            const vmDetails = await Promise.all( fixture.toObject()?.vmConfig?.map( async ( vm ) => {
                              const vmInfo = await planoVmService.findOne( { _id: vm.vmId } );
                              return {
                                ...vm,
                                ...vmInfo?.toObject(),
                              };
                            } ) );

                            return {
                              ...fixture.toObject(),
                              status: fixtureStatus,
                              shelfCount: shelves.length,
                              productCount: productCount,
                              vmCount: vmCount,
                              shelfConfig: shelfDetails,
                              vmConfig: vmDetails,
                            };
                          } ),
                      );

                      const otherElements = await storeFixtureService.find( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'other',
                      } );

                      return {
                        ...element,
                        fixtures: fixturesWithStatus,
                        otherElements: otherElements,
                      };
                    } ),
                );

                const centerFixtures = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'floor',
                } );

                const centerFixturesWithStatus = await Promise.all(
                    centerFixtures.map( async ( fixture ) => {
                      if ( fixture?.imageUrl ) {
                        let params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: fixture.imageUrl,
                        };
                        fixture.imageUrl = await signedUrl( params );
                      } else {
                        fixture.imageUrl = '';
                      }
                      productCapacity += fixture.toObject().fixtureCapacity;
                      const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                      const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                      const complianceCount = await planoComplianceService.count( {
                        fixtureId: fixture._id,
                        compliance: 'proper',
                        date: currentDate,
                      } );

                      const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { }, { shelfNumber: 1 } );

                      const shelfDetails = await Promise.all(
                          shelves.map( async ( shelf ) => {
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                            return {
                              ...shelf.toObject(),
                              productCount: productCount,
                              vmCount: vmCount,
                            };
                          } ),
                      );

                      let fixtureStatus;

                      const cvProcessStatus = await planoQrConversionRequestService.count( { fixtureId: fixture._id, date: currentDate, status: 'initiated' } );

                      if ( cvProcessStatus ) {
                        fixtureStatus = 'inprogress';
                      } else {
                        const missingCount = await planoComplianceService.count( {
                          fixtureId: fixture._id,
                          compliance: 'missing',
                          date: currentDate,
                        } );
                        fixtureStatus = complianceCount === 0 && !missingCount ? '' : complianceCount === productCount ? 'complete' : 'incomplete';
                      }


                      const vmDetails = await Promise.all( fixture.toObject().vmConfig.map( async ( vm ) => {
                        const vmInfo = await planoVmService.findOne( { _id: vm.vmId } );

                        return {
                          ...vm,
                          ...vmInfo?.toObject(),
                        };
                      } ) );

                      return {
                        ...fixture.toObject(),
                        status: fixtureStatus,
                        shelfCount: shelves.shelves,
                        productCount: productCount,
                        vmCount: vmCount,
                        shelfConfig: shelfDetails,
                        vmConfig: vmDetails,

                      };
                    } ),
                );


                const otherElements = await storeFixtureService.find( {
                  floorId: floor._id,
                  associatedElementType: { $exists: false },
                  associatedElementNumber: { $exists: false },
                  fixtureType: 'other',
                } );

                return {
                  ...floor.toObject(),
                  layoutPolygon: layoutPolygonWithFixtures,
                  centerFixture: centerFixturesWithStatus,
                  productCount: productCapacity,
                  // productCapacity: productCapacity,
                  otherElements: otherElements,
                };
              } ),
          );

          return {
            ...planogram.toObject(),
            floors: floorsWithFixtures,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeFixturesv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function fixtureShelfProductv2( req, res ) {
  try {
    const { planoId, fixtureId } = req.body;

    const [ planogram, fixture ] = await Promise.all( [
      planoService.findOne(
          { _id: new mongoose.Types.ObjectId( planoId ) },
          { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
      ),
      storeFixtureService.findOne( { _id: new mongoose.Types.ObjectId( fixtureId ) } ),
    ] );

    if ( !planogram ) return res.sendError( 'Planogram not found', 204 );
    if ( !fixture ) return res.sendError( 'Fixture not found', 204 );


    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    const getProducts = async ( mappings ) => {
      const productIds = mappings.map( ( mapping ) => mapping.productId );
      const products = await planoProductService.find( { _id: { $in: productIds }, type: 'product' } );
      const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );

      return await Promise.all(
          mappings.map( async ( mapping ) => {
            const productData = productMap.get( mapping?.productId?.toString() ) || {};
            delete productData._id;
            const mappingCompliance = await planoComplianceService.findOne( {
              planoMappingId: mapping._id,
              date: currentDate,
            } );
            const status = mappingCompliance ? mappingCompliance.compliance : '';
            return { ...mapping.toObject(), ...productData, status };
          } ),
      );
    };

    const vmDetails = await Promise.all( fixture.toObject()?.vmConfig?.map( async ( vm ) => {
      const vmInfo = await planoVmService.findOne( { _id: vm.vmId } );
      return {
        ...vm,
        ...vmInfo?.toObject(),
      };
    } ) );

    if ( fixture.toObject().productResolutionLevel === 'L1' ) {
      const productMappings = await planoMappingService.find( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'product' } );
      const productDetails = await getProducts( productMappings );
      return res.sendSuccess( { ...fixture.toObject(), products: productDetails, vmConfig: vmDetails, productCount: productMappings.length } );
    }

    if ( [ 'L2', 'L3', 'L4' ].includes( fixture.toObject().productResolutionLevel ) ) {
      const fixtureShelves = await fixtureShelfService.findAndSort( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) }, {}, { shelfNumber: 1 } );
      const productCount = await planoMappingService.count( { fixtureId: new mongoose.Types.ObjectId( fixtureId ), type: 'product' } );
      const shelfProducts = await Promise.all(
          fixtureShelves.map( async ( shelf ) => {
            const productMappings = await planoMappingService.find( { shelfId: shelf._id, type: 'product' } );
            const productDetails = await getProducts( productMappings );
            return { ...shelf.toObject(), products: productDetails };
          } ),
      );
      return res.sendSuccess( { ...fixture.toObject(), shelves: shelfProducts, vmConfig: vmDetails, productCount: productCount } );
    }

    return res.sendError( 'Incorrect resolution level', 400 );
  } catch ( e ) {
    logger.error( { functionName: 'fixtureShelfProductv1', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function storeFixturesTaskv2( req, res ) {
  try {
    const planoIds = req.body.id
        .filter( ( id ) => mongoose.Types.ObjectId.isValid( id ) )
        .map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        {
          $or: [
            { _id: { $in: planoIds } },
            { storeId: { $in: req.body.id } },
          ],
        },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1, scanType: 1, validateShelfSections: 1 },
    );

    if ( !planograms?.length ) return res.sendError( 'No data found', 204 );


    const storeLayout = await Promise.all(
        planograms.map( async ( planogram ) => {
          const floors = await storeBuilderService.find(
              { planoId: planogram._id },
              { floorName: 1, layoutPolygon: 1, planoId: 1 },
          );

          const floorsWithFixtures = await Promise.all(
              floors.map( async ( floor ) => {
                let productCapacity = 0;
                const layoutPolygonWithFixtures = await Promise.all(
                    floor.layoutPolygon.map( async ( element ) => {
                      const fixtures = await storeFixtureService.findAndSort( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'wall',
                      }, { shelfcount: 0 }, { fixtureNumber: 1 } );

                      const fixturesWithStatus = await Promise.all(
                          fixtures.map( async ( fixture ) => {
                            if ( fixture?.imageUrl || fixture.vmImageUrl ) {
                              let params = {
                                Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                                file_path: req.body.type == 'vm' ? fixture.vmImageUrl : fixture.imageUrl,
                              };
                              fixture.imageUrl = await signedUrl( params );
                            } else {
                              fixture.imageUrl = '';
                            }
                            productCapacity += fixture.toObject().fixtureCapacity;
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                            const compliance = await planoTaskComplianceService.findOne( {
                              fixtureId: fixture._id,
                              type: req.body?.type ? req.body.type : 'fixture',
                              date_string: req.body?.date,
                            }, { status: 1 } );

                            const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                            const shelfDetails = await Promise.all(
                                shelves.map( async ( shelf ) => {
                                  const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                                  const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                                  return {
                                    ...shelf.toObject(),
                                    productCount: productCount,
                                    vmCount: vmCount,
                                  };
                                } ),
                            );


                            const vmDetails = await Promise.all( fixture.toObject()?.vmConfig?.map( async ( vm ) => {
                              const vmInfo = await planoVmService.findOne( { _id: vm.vmId } );
                              return {
                                ...vm,
                                ...vmInfo?.toObject(),
                              };
                            } ) );

                            return {
                              ...fixture.toObject(),
                              status: compliance?.status ? compliance.status : '',
                              shelfCount: shelves.length,
                              productCount: productCount,
                              vmCount: vmCount,
                              shelfConfig: shelfDetails,
                              vmConfig: vmDetails,
                            };
                          } ),
                      );

                      const otherElements = await storeFixtureService.find( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'other',
                      } );

                      return {
                        ...element,
                        fixtures: fixturesWithStatus,
                        otherElements: otherElements,
                      };
                    } ),
                );

                const centerFixtures = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'floor',
                } );

                const centerFixturesWithStatus = await Promise.all(
                    centerFixtures.map( async ( fixture ) => {
                      if ( fixture?.imageUrl || fixture.vmImageUrl ) {
                        let params = {
                          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                          file_path: req.body.type == 'vm' ? fixture.vmImageUrl : fixture.imageUrl,
                        };
                        fixture.imageUrl = await signedUrl( params );
                      } else {
                        fixture.imageUrl = '';
                      }
                      productCapacity += fixture.toObject().fixtureCapacity;
                      const productCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'product' } );

                      const vmCount = await planoMappingService.count( { fixtureId: fixture._id, type: 'vm' } );

                      const compliance = await planoTaskComplianceService.findOne( {
                        fixtureId: fixture._id,
                        type: req.body?.type ? req.body.type : 'fixture',
                        date_string: req.body?.date,
                      }, { status: 1 } );

                      const shelves = await fixtureShelfService.findAndSort( { fixtureId: fixture._id }, { shelfNumber: 1, sectionName: 1, sectionZone: 1, shelfCapacity: 1, shelfSplitup: 1 }, { shelfNumber: 1 } );

                      const shelfDetails = await Promise.all(
                          shelves.map( async ( shelf ) => {
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'product' } );

                            const vmCount = await planoMappingService.count( { fixtureId: fixture._id, shelfId: shelf.toObject(), type: 'vm' } );

                            return {
                              ...shelf.toObject(),
                              productCount: productCount,
                              vmCount: vmCount,
                            };
                          } ),
                      );

                      const vmDetails = await Promise.all( fixture.toObject()?.vmConfig?.map( async ( vm ) => {
                        const vmInfo = await planoVmService.findOne( { _id: vm.vmId } );
                        return {
                          ...vm,
                          ...vmInfo?.toObject(),
                        };
                      } ) );

                      return {
                        ...fixture.toObject(),
                        status: compliance?.status ? compliance.status : '',
                        shelfCount: shelves.shelves,
                        productCount: productCount,
                        vmCount: vmCount,
                        shelfConfig: shelfDetails,
                        vms: vmDetails,
                      };
                    } ),
                );

                // const productCount = await planoMappingService.count( { floorId: floor._id } );

                const otherElements = await storeFixtureService.find( {
                  floorId: floor._id,
                  associatedElementType: { $exists: false },
                  associatedElementNumber: { $exists: false },
                  fixtureType: 'other',
                } );

                return {
                  ...floor.toObject(),
                  layoutPolygon: layoutPolygonWithFixtures,
                  centerFixture: centerFixturesWithStatus,
                  productCount: productCapacity,
                  // productCapacity: productCapacity,
                  otherElements: otherElements,
                };
              } ),
          );

          return {
            ...planogram.toObject(),
            floors: floorsWithFixtures,
          };
        } ),
    );

    return res.sendSuccess( storeLayout );
  } catch ( e ) {
    logger.error( { functionName: 'storeFixturesTask', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

export async function planoList( req, res ) {
  try {
    let inputData = req.body;
    let limit = inputData?.limit || 10;
    let page = inputData?.offset - 1 || 0;
    let skip = limit * page;
    let query = [
      {
        $match: {
          clientId: inputData.clientId,
        },
      },
      {
        $lookup: {
          from: 'storelayouts',
          let: { plano: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [ '$planoId', '$$plano' ],
                },
              },
            },
            {
              $group: {
                _id: '',
                layoutDetails: { $push: { k: '$_id', v: '$status', planoId: '$$plano' } },
              },
            },
          ],
          as: 'layout',
        },
      },
      { $unwind: { path: '$layout', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'storefixtures',
          let: { plano: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [ '$planoId', '$$plano' ],
                },
              },
            },
            {
              $group: {
                _id: '',
                fixtureCount: { $sum: 1 },
                vmCount: { $sum: { $size: '$vmConfig' } },
                fixtureCapacity: { $sum: '$fixtureCapacity' },
              },
            },
          ],
          as: 'fixtureDetails',
        },
      },
      { $unwind: { path: '$fixtureDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          storeName: 1,
          layoutName: 1,
          layoutDetails: '$layout.layoutDetails',
          fixtureCount: '$fixtureDetails.fixtureCount',
          vmCount: '$fixtureDetails.vmCount',
          fixtureCapacity: '$fixtureDetails.fixtureCapacity',
          status: 1,
          planoProcess: 1,
        },
      },
    ];
    if ( inputData.sortColumnName && inputData.sortBy ) {
      query.push( { $sort: { [inputData.sortColumnName]: inputData.sortBy } } );
    }
    if ( inputData.searchValue ) {
      query.push( {
        $match: {
          storeName: { $regex: inputData.searchValue, $options: 'i' },
        },
      } );
    }

    query.push( {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
        ],
        count: [
          { $count: 'total' },
        ],
      },
    } );

    let planoDetails = await planoService.aggregate( query );

    if ( !planoDetails[0].data.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      data: planoDetails[0].data,
      count: planoDetails?.[0]?.count?.[0]?.total || 0,
    };
    await Promise.all( planoDetails.map( ( ele ) => {
      if ( ele.layoutDetails ) {

      }
    } ) );
    return res.sendSuccess( result );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'planoList', error: e } );
    return res.sendError( e, 500 );
  }
}
