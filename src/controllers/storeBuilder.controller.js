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
          const floors = await storeBuilderService.find( { planoId: planogram._id }, { floorName: 1, layoutPolygon: 1 } );
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
    const planoIds = req.body.id.map( ( id ) => new mongoose.Types.ObjectId( id ) );

    const planograms = await planoService.find(
        { _id: { $in: planoIds } },
        { storeId: 1, storeName: 1, planoId: '$_id', productResolutionLevel: 1 },
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
                const layoutPolygonWithFixtures = await Promise.all(
                    floor.layoutPolygon.map( async ( element ) => {
                      const fixtures = await storeFixtureService.find( {
                        floorId: floor._id,
                        associatedElementType: element.elementType,
                        associatedElementNumber: element.elementNumber,
                        fixtureType: 'wall',
                      } );

                      const fixturesWithStatus = await Promise.all(
                          fixtures.map( async ( fixture ) => {
                            const productCount = await planoMappingService.count( { fixtureId: fixture._id } );

                            const complianceCount = await planoComplianceService.count( {
                              fixtureId: fixture._id,
                              compliance: 'proper',
                              date: currentDate,
                            } );

                            return {
                              ...fixture.toObject(),
                              status: complianceCount === 0 ? '' : complianceCount === productCount ? 'complete' : 'incomplete',
                              productCount: productCount,
                            };
                          } ),
                      );

                      return {
                        ...element,
                        fixtures: fixturesWithStatus,
                      };
                    } ),
                );

                const centerFixtures = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'floor',
                } );

                const centerFixturesWithStatus = await Promise.all(
                    centerFixtures.map( async ( fixture ) => {
                      const productCount = await planoMappingService.count( { fixtureId: fixture._id } );

                      const complianceCount = await planoComplianceService.count( {
                        fixtureId: fixture._id,
                        compliance: 'proper',
                        date: currentDate,
                      } );

                      return {
                        ...fixture.toObject(),
                        status: complianceCount === 0 ? '' : complianceCount === productCount ? 'complete' : 'incomplete',
                        productCount: productCount,
                      };
                    } ),
                );

                const productCount = await planoMappingService.count( { floorId: floor._id } );

                const otherElements = await storeFixtureService.find( {
                  floorId: floor._id,
                  fixtureType: 'other',
                } );

                return {
                  ...floor.toObject(),
                  layoutPolygon: layoutPolygonWithFixtures,
                  centerFixture: centerFixturesWithStatus,
                  productCount: productCount,
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

export async function fixtureShelfProductv1( req, res ) {
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

    const currentDate = new Date( dayjs().format( 'YYYY-MM-DD' ) );

    if ( fixture.toObject().productResolutionLevel === 'L1' ) {
      const productMappings = await planoMappingService.find( { fixtureId: new mongoose.Types.ObjectId( fixtureId ) } );
      const productIds = productMappings.map( ( mapping ) => mapping.productId );
      const products = await planoProductService.find( { _id: { $in: productIds } } );
      const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );

      const productDetails = await Promise.all(
          productMappings.map( async ( mapping ) => {
            const productData = productMap.get( mapping.productId.toString() ) || {};
            const mappingCompliance = await planoComplianceService.findOne( {
              planoMappingId: mapping._id,
              date: currentDate,
            } );

            const status = mappingCompliance ? mappingCompliance.compliance : 'missing';

            return { ...mapping.toObject(), ...productData, status };
          } ),
      );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

      return res.sendSuccess( { ...fixture.toObject(), products: productDetails, fixtureMetrics: fixtureMetrics } );
    }
    if ( fixture.toObject().productResolutionLevel === 'L2' || fixture.toObject().productResolutionLevel === 'L4' ) {
      const fixtureShelves = await fixtureShelfService.find( {
        fixtureId: new mongoose.Types.ObjectId( fixtureId ),
      } );

      if ( !fixtureShelves.length ) return res.sendError( 'No shelves found for the fixture', 204 );

      const shelfProducts = await Promise.all(
          fixtureShelves.map( async ( shelf ) => {
            const productMappings = await planoMappingService.find( { shelfId: shelf._id } );

            if ( !productMappings.length ) {
              return { ...shelf.toObject(), products: [] };
            }

            const productIds = productMappings.map( ( mapping ) => mapping.productId );
            const products = await planoProductService.find( { _id: { $in: productIds } } );
            const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );

            const productDetails = await Promise.all(
                productMappings.map( async ( mapping ) => {
                  const productData = productMap.get( mapping.productId.toString() );
                  if ( !productData ) {
                    return { ...mapping.toObject(), status: '' };
                  }

                  const mappingCompliance = await planoComplianceService.findOne( {
                    planoMappingId: mapping._id,
                    date: currentDate,
                  } );

                  const status = mappingCompliance ? mappingCompliance.compliance : 'missing';

                  return {
                    ...mapping.toObject(),
                    ...productData,
                    status,
                  };
                } ),
            );

            return {
              ...shelf.toObject(),
              products: productDetails,
            };
          } ),
      );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

      return res.sendSuccess( { ...fixture.toObject(), shelves: shelfProducts, fixtureMetrics: fixtureMetrics } );
    } else if ( fixture.toObject().productResolutionLevel === 'L3' ) {
      const fixtureShelves = await fixtureShelfService.find( {
        fixtureId: new mongoose.Types.ObjectId( fixtureId ),
      } );

      if ( !fixtureShelves.length ) return res.sendError( 'No shelves found for the fixture', 204 );
      const groupedShelves = await ( async () => {
        const shelfProducts = await Promise.all(
            fixtureShelves.map( async ( shelf ) => {
              const productMappings = await planoMappingService.find( { shelfId: shelf._id } );

              if ( !productMappings.length ) {
                return { ...shelf.toObject(), products: [] };
              }

              const productIds = productMappings.map( ( mapping ) => mapping.productId );
              const products = await planoProductService.find( { _id: { $in: productIds } } );
              const productMap = new Map( products.map( ( product ) => [ product._id.toString(), product.toObject() ] ) );


              const productDetails = await Promise.all(
                  productMappings.map( async ( mapping ) => {
                    const productData = productMap.get( mapping.productId.toString() );
                    if ( !productData ) {
                      return { ...mapping.toObject(), status: '' };
                    }

                    const mappingCompliance = await planoComplianceService.findOne( {
                      planoMappingId: mapping._id,
                      date: currentDate,
                    } );

                    const status = mappingCompliance ? mappingCompliance.compliance : 'missing';

                    return {
                      ...mapping.toObject(),
                      ...productData,
                      status,
                    };
                  } ),
              );

              return {
                ...shelf.toObject(),
                products: productDetails,
              };
            } ),
        );

        return shelfProducts.reduce( ( acc, shelf ) => {
          const sectionName = shelf.sectionName || 'Unknown';
          if ( !acc[sectionName] ) {
            acc[sectionName] = [];
          }
          acc[sectionName].push( shelf );
          return acc;
        }, {} );
      } )();

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }
      return res.sendSuccess( { ...fixture.toObject(), categories: groupedShelves, fixtureMetrics: fixtureMetrics } );
    } else {
      return res.sendError( 'Incorrect resolution level', 400 );
    }
  } catch ( e ) {
    logger.error( { functionName: 'fixtureShelfProductv1', error: e, message: req.body } );
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
    let productCheck = await planoMappingService.findOne( { rfId: req.body.rfId } );
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

    let planoProductDetails = await planoMappingService.findOne( query );
    // let data = {
    //   ...( planoProductDetails ) ? { ...planoProductDetails._doc } : { planoId: req.body?.planoId, floorId: req.body?.floorId, fixtureId: req.body?.fixtureId, shelfId: shelfId, clientId: planoDetails.clientId, storeName: planoDetails.storeName, storeId: planoDetails.storeId, shelfPosition: req.body?.shelfPosition },
    //   rfId: req.body.rfId,
    //   compliance: !planoProductDetails ? 'misplaced' : 'proper',
    //   date: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
    // };
    let data = {
      planoId: req.body?.planoId,
      floorId: req.body?.floorId,
      fixtureId: req.body?.fixtureId,
      shelfId: shelfId,
      clientId: planoDetails.clientId,
      storeName: planoDetails.storeName,
      storeId: planoDetails.storeId,
      shelfPosition: req.body?.shelfPosition,
      rfId: req.body.rfId,
      compliance: !planoProductDetails ? 'misplaced' : 'proper',
      date: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
    };
    delete data._id;
    delete query.rfId;
    query = { ...query, date: new Date( dayjs().format( 'YYYY-MM-DD' ) ), shelfPosition: req.body.shelfPosition };
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

        const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          missing: 0,
          proper: properProducts,
        };

        if ( fixtureMetrics.scanned === 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total;
        } else if ( fixtureMetrics.scanned > 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
        }

        return res.sendSuccess( { data: { ...misplacedProductMapping.toObject(), ...( misplacedProductDetails ? misplacedProductDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

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

        const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          missing: 0,
          proper: properProducts,
        };

        if ( fixtureMetrics.scanned === 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total;
        } else if ( fixtureMetrics.scanned > 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
        }

        return res.sendSuccess( { data: { ...misplacedProductMapping.toObject(), ...( misplacedProductDetails ? misplacedProductDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

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

          const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
            planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
            planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
          ] );

          const fixtureMetrics = {
            total: totalProducts,
            scanned: scannedProducts,
            misplaced: misplacedProducts,
            missing: 0,
            proper: properProducts,
          };

          if ( fixtureMetrics.scanned === 0 ) {
            fixtureMetrics.missing = fixtureMetrics.total;
          } else if ( fixtureMetrics.scanned > 0 ) {
            fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
          }
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

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

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


        const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
          planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
          planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
        ] );

        const fixtureMetrics = {
          total: totalProducts,
          scanned: scannedProducts,
          misplaced: misplacedProducts,
          missing: 0,
          proper: properProducts,
        };

        if ( fixtureMetrics.scanned === 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total;
        } else if ( fixtureMetrics.scanned > 0 ) {
          fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
        }

        return res.sendSuccess( { data: { ...productMapping.toObject(), ...( productDetails ? productDetails?.toObject() : {} ) }, fixtureMetrics: fixtureMetrics, status: 'misplaced' } );
      }

      const complianceData = { ...productMapping.toObject(), planoMappingId: productMapping.toObject()._id, compliance: 'proper' };
      delete complianceData._id;

      let productDetails = await planoProductService.findOne( { _id: productMapping.toObject().productId } );

      await planoComplianceService.updateOne( { ...mappingQuery, date: currentDate }, complianceData );

      const [ totalProducts, scannedProducts, misplacedProducts, properProducts ] = await Promise.all( [
        planoMappingService.count( { fixtureId: fixture.toObject()._id } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'misplaced' } ),
        planoComplianceService.count( { fixtureId: fixture.toObject()._id, date: currentDate, compliance: 'proper' } ),
      ] );

      const fixtureMetrics = {
        total: totalProducts,
        scanned: scannedProducts,
        misplaced: misplacedProducts,
        missing: 0,
        proper: properProducts,
      };

      if ( fixtureMetrics.scanned === 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total;
      } else if ( fixtureMetrics.scanned > 0 ) {
        fixtureMetrics.missing = fixtureMetrics.total - ( fixtureMetrics.misplaced + fixtureMetrics.proper );
      }

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
        'rfId': req.body.data[i].rfId,
      };

      const createdShelf = await fixtureShelfService.create( shelfData );

      for ( let j = 0; j < req.body.data[i].products.length; j++ ) {
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
          'productId': new mongoose.Types.ObjectId( '6791cbbee08740593c281795' ),
          'rfId': req.body.data[i].products[j].rfId,
          'category': 'middle',
        };
        await planoMappingService.create( productMapping );
        console.log( j );
      }
    }

    res.sendSuccess( fixture );
  } catch ( e ) {
    logger.error( { functionName: 'bulkAdd', error: e, message: req.body } );
    return res.sendError( e, 500 );
  }
}

// const data = {
//   floors: [
//     { id: '9687687',
//       fixtures: [
//         {
//           id: '123456',
//           shelves: [
//             {
//               id: '789012',
//               sectionName: 'top',
//               products: [ 'p1', 'p2' ],
//             },
//           ],
//         },
//       ],
//     },
//   ],
// };

// import * as fs from 'fs';

// const data = [
//   {
//     'facility_code': 'LKST98',
//     'product_id': 207042,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015799816',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136339,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018441122',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215253,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016547409',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131443,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017249906',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218231,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017387138',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217759,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019164042',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222476,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019302739',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216735,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016874512',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 152701,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ010870317',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 113125,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019698519',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215257,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016553360',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201411,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019614368',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217748,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017008428',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 151243,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018951414',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136632,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'MP Exclusive',
//     'itemcode': 'JJJ016683258',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209678,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015403089',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 142894,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017096206',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134224,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ016758576',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217271,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018094774',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135216,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ012422630',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137154,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'IIM14584811334',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213687,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ016570126',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216734,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018987501',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215259,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016557719',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 151008,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017510060',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135212,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148301,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ013282217',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209669,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ020383111',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225403,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021450194',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222482,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019309235',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146882,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ010563039',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136173,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017964781',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215251,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016546005',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 151229,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016784634',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 138262,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223227,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019786945',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217742,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017004117',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213682,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016761202',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136387,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'MP Exclusive',
//     'itemcode': 'JJJ014036647',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216872,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016925728',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216732,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016868016',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211194,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017111749',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213150,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ016200426',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 140628,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211283,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015878455',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215254,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213096,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ016179879',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201387,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135940,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018211017',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147672,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017353536',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222480,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019307365',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225419,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131411,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018146683',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215582,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ020557321',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148306,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019094230',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209442,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015280180',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137915,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ019707664',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 208092,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ014754482',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201392,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016334204',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213683,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ016565166',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217997,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017877328',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146203,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ020363392',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131410,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'IIM14584771039',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217180,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 127290,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 2,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017184241',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217998,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017853235',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209664,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216854,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019143077',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225414,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131447,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018154137',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216737,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ016881423',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222473,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019299934',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 144598,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ019719022',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 150854,
//     'brand': 'John Jacobs Online',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Disabled',
//     'itemcode': 'JJJ016444926',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216860,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019134570',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 206146,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ013080792',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217754,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017012423',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211282,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018253452',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215250,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ020917534',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201397,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017424440',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209436,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015274209',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218001,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017857035',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136177,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018540109',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147919,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ013943206',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201389,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016318710',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222485,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019311423',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215252,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016546394',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 127190,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019700619',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209662,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 117020,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016029216',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147911,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ011324141',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 140632,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 2,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018585136',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 140647,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ020341285',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215281,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018519697',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134949,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 2,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018898893',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 143308,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ016041078',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213684,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017952554',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131240,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Disabled',
//     'itemcode': 'JJJ019081418',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216744,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018994959',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131413,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217175,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018257705',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 210232,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015487317',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216856,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016961699',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148387,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ011481213',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218233,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017390447',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135938,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ013823969',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201388,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017122291',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 212733,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ020167970',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225421,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148379,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ012319639',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147903,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ012956307',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134940,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017489735',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213692,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136188,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ013161586',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209663,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017532600',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209667,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017306472',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146598,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 205898,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016810198',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211281,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015865419',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211192,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016853383',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216745,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018996755',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137505,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015530319',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217758,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017014555',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137919,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019021119',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137918,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018018624',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225408,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021455464',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217992,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018284622',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 113114,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ016025627',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201436,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017123666',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148208,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ012941914',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217177,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016990809',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 145910,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017222581',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146204,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146465,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'CCC032100087',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215750,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016599813',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217991,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018294187',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147906,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ014062305',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131266,
//     'brand': 'John Jacobs Online',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'CCC013785393',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218003,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017887016',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215572,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017252560',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 150666,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'CCC032789581',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217774,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017026293',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216865,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016970449',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 205899,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017586754',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 210124,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017682162',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 145911,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017321568',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217182,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017000169',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216731,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016864020',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218235,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017393785',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216850,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018073365',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216741,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019513725',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217768,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017021755',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147676,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017087745',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211190,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015840767',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218238,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018413830',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217173,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016983134',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211284,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019497437',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215748,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016596615',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147910,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ014063429',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216747,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016908062',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201374,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017037252',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147909,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ012960727',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135865,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 4,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018475675',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 212735,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016140174',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146464,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ012137295',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215256,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018967151',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218932,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019315551',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 138248,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019627055',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135440,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ019057004',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217760,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017015715',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217752,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017010921',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223233,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019806882',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131415,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ018148576',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216740,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019510919',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225406,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021454381',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216746,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019521308',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 148398,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ014083655',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137156,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016011023',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 212737,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134947,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ020585008',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225390,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021438591',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216739,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ019508157',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146474,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016462048',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215742,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 142893,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017095776',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209438,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015276828',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135438,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ019641251',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216863,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019584166',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 205964,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017053864',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135067,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ020135950',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216743,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018993861',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225401,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021448381',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 212736,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016143514',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136068,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017474101',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 206788,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017610679',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211193,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 210123,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017345247',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134951,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 2,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018900309',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211189,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ020502002',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 116965,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ011726693',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223230,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019798998',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209666,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ020379922',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215544,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018509363',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211195,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015864092',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222479,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019305541',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216847,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018069792',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147661,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ012968503',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 149143,
//     'brand': 'John Jacobs Online',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ010364902',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225405,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021452417',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211191,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015847613',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137916,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ020334889',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 138844,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ011812635',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201373,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017584137',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209440,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015279043',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137153,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213690,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016575211',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225424,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021466233',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217761,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017016755',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 207044,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ015805244',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 149200,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ017035776',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217769,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017022860',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216738,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018992049',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136190,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ019085200',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134578,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016257466',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 131241,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ012211170',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 149419,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018942890',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218931,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018611990',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209665,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 152881,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017200258',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 147921,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 2,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017577402',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134953,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 3,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017467547',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215282,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ020305719',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 142523,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018530383',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223235,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019812621',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 132041,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ021072697',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225411,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021459060',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211713,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215553,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017923721',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 142515,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018522473',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216733,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016870551',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 152704,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ010874375',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209661,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ016785709',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213143,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016193384',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 222471,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019298598',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217181,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019539001',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216742,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018992953',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225388,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021434818',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216851,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019121818',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 149152,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018159564',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 138326,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ011488504',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 213144,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019106064',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215271,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ017914848',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 216885,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016943118',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 142524,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ018021701',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223224,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019777778',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 140648,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017996649',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 116967,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ013594600',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201391,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018956593',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223231,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019800174',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215746,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ016592888',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 137917,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 116979,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ017941244',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217772,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017025081',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 215272,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217171,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ019523823',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 217176,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018252576',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146596,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ018550620',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136174,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ013640284',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225417,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ021461820',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 224844,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': 'JJJ020732970',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 146600,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ013733282',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 211181,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ015813335',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 201371,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ012879732',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 218234,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017392132',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134220,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ019702022',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223226,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019783710',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 208090,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ014753455',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 223222,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': 'JJJ019770887',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209443,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015281008',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 133686,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ018108124',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 136408,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Core',
//     'itemcode': 'JJJ020604228',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209434,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'YES',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Singapore Ex',
//     'itemcode': 'JJJ015272160',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 225416,
//     'brand': 'John Jacobs',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'New Launches',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 138845,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ014740833',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 212828,
//     'brand': 'John Jacobs Online',
//     'category': 'sunglasses',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Discontinued',
//     'itemcode': 'JJJ016162031',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 209679,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity A',
//     'itemcode': '',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 135439,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': 'JJJ017669333',
//   },
//   {
//     'facility_code': 'LKST98',
//     'product_id': 134576,
//     'brand': 'John Jacobs',
//     'category': 'eyeframe',
//     'zone': 'South',
//     'tlp_status': 'N',
//     'lf_nonlf': 'LF',
//     'kpi': 'SOH',
//     'qty': 1,
//     'created_at': '1/31/2025',
//     'store_type': 'COCO',
//     'status': 'Active',
//     'PLC': 'Continuity',
//     'itemcode': '',
//   },
// ];

// const cleanData = ( data ) => {
//   return data.map( ( { product_id, brand, category, itemcode } ) => ( {
//     productId: String( product_id ),
//     productBrand: brand,
//     productType: category,
//     clientId: '11',
//     type: 'new',
//     itemcode,
//   } ) );
// };

// const saveToFile = ( filename, content ) => {
//   const textContent = JSON.stringify( content, null, 2 );
//   fs.writeFileSync( filename, textContent, 'utf-8' );
//   console.log( `File saved as ${filename}` );
// };

// const cleanedData = cleanData( data );
// saveToFile( 'output.txt', cleanedData );


// Find Duplicate Ids

import fs from 'fs';

async function findDuplicates() {
  try {
    const keys1 = await planoMappingService.find( { clientId: '11' }, { rfId: 1, _id: 0 } );
    const keys2 = await fixtureShelfService.find( { clientId: '11' }, { rfId: 1, _id: 0 } );

    const keyArray1 = keys1.map( ( doc ) => doc.toObject().rfId );
    const keyArray2 = keys2.map( ( doc ) => doc.toObject().rfId );

    const findDuplicatesInArray = ( arr ) => {
      const countMap = new Map();
      arr.forEach( ( key ) => countMap.set( key, ( countMap.get( key ) || 0 ) + 1 ) );
      return [ ...countMap.entries() ].filter( ( [ _, count ] ) => count > 1 ).map( ( [ key ] ) => key );
    };

    const duplicatesInCollection1 = findDuplicatesInArray( keyArray1 );
    const duplicatesInCollection2 = findDuplicatesInArray( keyArray2 );

    const set1 = new Set( keyArray1 );
    const set2 = new Set( keyArray2 );
    const duplicatesAcrossCollections = [ ...set1 ].filter( ( key ) => set2.has( key ) );

    let output = '';

    if ( duplicatesInCollection1.length > 0 ) {
      output += `Duplicates within product:\n${duplicatesInCollection1.join( '\n' )}\n\n`;
    }
    if ( duplicatesInCollection2.length > 0 ) {
      output += `Duplicates within shelf:\n${duplicatesInCollection2.join( '\n' )}\n\n`;
    }
    if ( duplicatesAcrossCollections.length > 0 ) {
      output += `Duplicates across product & shelf:\n${duplicatesAcrossCollections.join( '\n' )}\n\n`;
    }

    if ( output ) {
      const filePath = 'duplicates.txt';
      fs.writeFileSync( filePath, output, 'utf8' );
      console.log( `Duplicates written to ${filePath}` );
    } else {
      console.log( 'No duplicates found.' );
    }
  } catch ( error ) {
    console.error( 'Error:', error );
  }
}

// findDuplicates();
