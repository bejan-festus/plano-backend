import { logger } from 'tango-app-api-middleware';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as fixtureLibService from '../service/planoLibrary.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as planoService from '../service/planogram.service.js';
import * as storeService from '../service/store.service.js';
import * as processedTaskService from '../service/processedTaskservice.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as vmService from '../service/planoVm.service.js';
import { createTask } from './task.controller.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
const ObjectId = mongoose.Types.ObjectId;
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend( customParseFormat );


export async function createTemplate( req, res ) {
  try {
    let inputData = req.body;
    let getLibDetails = await fixtureLibService.findOne( { _id: inputData.fixtureLibraryId, clientId: inputData.clientId } );
    if ( !getLibDetails ) {
      return res.sendError( 'Fixture library id is wrong', 400 );
    }
    let fixtureCapacity = getLibDetails.shelfConfig.reduce(
        ( acc, ele ) => ele.trayRows ? acc + ( ele.trayRows * ele.productPerShelf ) : ( acc + ele.productPerShelf ),
        0,
    );
    let templateId = await getTemplateId();
    let templateData = {
      clientId: inputData.clientId,
      fixtureLibraryId: inputData.fixtureLibraryId,
      fixtureName: `${templateId}-${getLibDetails.fixtureCategory}`,
      fixtureCategory: getLibDetails.fixtureCategory,
      fixtureType: getLibDetails.fixtureType,
      fixtureHeight: getLibDetails.fixtureHeight,
      fixtureLength: getLibDetails.fixtureLength,
      fixtureWidth: getLibDetails.fixtureWidth,
      shelfConfig: getLibDetails.shelfConfig,
      header: getLibDetails.header,
      footer: getLibDetails.footer,
      isBodyEnabled: getLibDetails.isBodyEnabled,
      fixtureCapacity: fixtureCapacity,
      fixtureStaticLength: {
        value: 1524,
        unit: 'mm',
      },
      fixtureStaticWidth: {
        value: 1220,
        unit: 'mm',
      },
    };
    let fixtureData = await fixtureConfigService.create( templateData );
    return res.sendSuccess( { message: 'Fixture template created successfully', fixtureData } );
  } catch ( e ) {
    logger.error( { functionName: 'createTemplate', error: e } );
    return res.sendError( e, 500 );
  }
}

async function getTemplateId() {
  let templateId = 'Template01';
  let fixtureTemplateData = await fixtureConfigService.find( { fixtureName: { $exists: true } }, { fixtureName: 1 } );
  let fixtureData = fixtureTemplateData.map( ( ele ) => ele.fixtureName.split( '-' )[0] );
  let count = 1;
  while ( fixtureData.includes( templateId ) ) {
    count = count + 1;
    let countId = String( count ).padStart( 2, '0' );
    templateId =`Template${countId}`;
  }
  return templateId;
}

export async function updateTemplate( req, res ) {
  try {
    let inputData = req.body;
    let templateDetails = await fixtureConfigService.findOne( { _id: req.params.templateId } );
    if ( !templateDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    if ( inputData.status == 'complete' ) {
      let newFixture;
      delete inputData.store;
      if ( req.body?.new ) {
        templateDetails = templateDetails.toObject();
        delete templateDetails._id;
        let templateData = { ...templateDetails, ...inputData };
        newFixture = await fixtureConfigService.create( templateData );
      }
      let fixtureCapacity = inputData.shelfConfig.reduce( ( acc, ele ) => {
        if ( ele.shelfType == 'tray' ) {
          ele.productPerShelf = ele.trayRows * ele.productPerShelf;
        }
        acc = acc + ele.productPerShelf;
        return acc;
      },
      0 );

      let storeFixtureDetails = await storeFixtureService.find( { fixtureConfigId: req.params.templateId } );
      if ( storeFixtureDetails.length ) {
        let fixtureList = storeFixtureDetails.map( ( ele ) => ele._id );
        let fixtureData = {
          ...inputData,
          fixtureCapacity: fixtureCapacity,
          fixtureConfigId: newFixture ? newFixture._id : req.params.templateId,
        };
        delete fixtureData._id;
        delete fixtureData.status;
        await storeFixtureService.updateMany( { _id: { $in: fixtureList } }, fixtureData );
        await Promise.all( storeFixtureDetails.map( async ( fixture ) => {
          await fixtureShelfService.deleteMany( { fixtureId: fixture } );
          let shelfData = [];
          inputData.shelfConfig.forEach( ( ele, index ) => {
            shelfData.push( {
              productCategory: inputData.productCategory,
              productSubCategory: inputData.productCategory,
              shelfType: ele.shelfType,
              trayRows: ele.trayRows,
              shelfNumber: index + 1,
              fixtureId: fixture,
              clientId: req.body.clientId,
              planoId: fixture.planoId,
              floorId: fixture.floorId,
              productBrandName: ele.productBrandName,
              shelfOrder: 'LTR',
              shelfSplitup: 0,
              storeId: fixture.storeId,
              storeName: fixture.storeName,
              productPerShelf: ele.productPerShelf,
              sectionZone: ele.zone,
              zone: ele.zone,
            } );
          } );
          await fixtureShelfService.insertMany( shelfData );
        } ) );
      }
    }
    await fixtureConfigService.updateOne( { _id: req.params.templateId }, inputData );
    return res.sendSuccess( 'Fixture template details updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateTemplate', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deleteTemplate( req, res ) {
  try {
    let templateDetails = await fixtureConfigService.findOne( { _id: req.body.templateId } );
    if ( !templateDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let getFixtureDetails = await storeFixtureService.find( { fixtureConfigId: req.body.templateId }, { _id: 1, planoId: 1 } );
    if ( getFixtureDetails.length ) {
      let planoDetails = await planoService.find( { _id: getFixtureDetails.map( ( ele ) => ele.planoId ) } );
      return res.sendError( `Fixture template is mapped with ${planoDetails.length}`, 400 );
    }
    await fixtureConfigService.deleteOne( { _id: req.body.templateId } );
    return res.sendSuccess( 'Fixture template is deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteTemplate', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function duplicateTemplate( req, res ) {
  try {
    let templateDetails = await fixtureConfigService.findOne( { _id: req.body.templateId } );
    if ( !templateDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let getAllTemplate = await fixtureConfigService.findAndSort( { fixtureName: { $regex: templateDetails.fixtureName.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), $options: 'i' } }, { fixtureName: 1 }, { fixtureName: -1 } );
    let counter = 1;
    let newFixtureName = templateDetails.fixtureName + ` (${counter})`;
    if ( getAllTemplate?.length ) {
      let fixtureNameList = getAllTemplate.map( ( ele ) => ele.fixtureName );
      while ( fixtureNameList.includes( newFixtureName ) ) {
        newFixtureName = templateDetails.fixtureName + ` (${counter})`;
        counter++;
      }
    }
    templateDetails = templateDetails.toObject();
    delete templateDetails._id;
    templateDetails.fixtureName = newFixtureName;
    let duplicateDetails = await fixtureConfigService.create( templateDetails );
    return res.sendSuccess( { message: 'Fixture template duplicated successfully', id: duplicateDetails._id } );
  } catch ( e ) {
    logger.error( { functionName: 'duplicateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getTemplateDetails( req, res ) {
  try {
    let templateDetails = await fixtureConfigService.findOne( { _id: req.query.templateId } );
    if ( !templateDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let query = [
      {
        $match: {
          fixtureConfigId: new ObjectId( req.query.templateId ),
        },
      },
      {
        $group: {
          _id: '',
          store: { $addToSet: '$storeName' },
        },
      },
    ];
    templateDetails = templateDetails.toObject();
    templateDetails.vmConfig = await Promise.all( templateDetails.vmConfig.map( async ( vm ) => {
      let vmDetails = await vmService.findOne( { _id: vm.vmId } );
      if ( vmDetails ) {
        vm = { ...vm, ...vmDetails.toObject() };
        return vm;
      }
    } ) );
    let mappedStoreList = await storeFixtureService.aggregate( query );
    let storeList = mappedStoreList?.[0]?.store || [];
    let storeDetails = await storeService.find( { clientId: templateDetails.clientId, storeName: { $in: storeList } }, { storeName: 1, storeId: 1, spocDetails: 1 } );
    let storeFixtureDetails = await storeFixtureService.find( { fixtureConfigId: req.query.templateId } );
    if ( storeFixtureDetails.length ) {
      let fixtureId = storeFixtureDetails.map( ( ele ) => ele.planoId );
      let planoDetails = await planoService.find( { _id: { $in: fixtureId } }, { status: 1 } );
      planoDetails = planoDetails.map( ( ele ) => ele.status );
      templateDetails.status = planoDetails.includes( 'completed' ) ? 'active' : 'inactive';
    }
    let data = {
      ...templateDetails,
      store: storeDetails.map( ( ele ) => {
        return { storeName: ele.storeName, storeId: ele.storeId, userEmail: ele?.spocDetails?.[0]?.email };
      } ),
    };
    return res.sendSuccess( data );
  } catch ( e ) {
    logger.error( { functionName: 'getTemplateDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getTemplateList( req, res ) {
  try {
    let limit = req.body?.limit || 10;
    let page = req.body?.offset || 1;
    let skip = limit * ( page - 1 );

    const matchStage = {
      clientId: req.body.clientId,
      ...( req.body?.searchValue ?
      { fixtureName: { $regex: req.body.searchValue, $options: 'i' } } :
      {} ),
      ...( req.body?.filter?.brand?.length ?
      { $or: [
        { 'productBrandName': { $in: req.body.filter.brand } },
        { 'shelfConfig.productBrandName': { $in: req.body.filter.brand } },
      ] } :
      {} ),
      ...( req.body?.filter?.category?.length ?
      { fixtureCategory: { $in: req.body.filter.category } } :
      {} ),
      ...( req.body?.filter?.subCategory?.length ?
      { productSubCategory: { $in: req.body.subCategory.category } } :
      {} ),
    };

    const query = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'storefixtures',
          let: { templateId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [ '$$templateId', '$fixtureConfigId' ],
                },
              },
            },
            {
              $group: {
                _id: null,
                planoId: { $addToSet: '$planoId' },
              },
            },
            {
              $project: {
                _id: 0,
                planoId: 1,
              },
            },
          ],
          as: 'storeFixtureDetails',
        },
      },
      {
        $project: {
          fixtureCategory: 1,
          fixtureName: 1,
          fixtureWidth: 1,
          productBrandName: 1,
          productCategory: 1,
          clientId: 1,
          productSubCategory: 1,
          status: 1,
          fixtureType: 1,
          vmCapacity: { $size: '$vmConfig' },
          productCapacity: {
            $sum: {
              $map: {
                input: '$shelfConfig',
                as: 'shelf',
                in: '$$shelf.productPerShelf',
              },
            },
          },
          planoId: { $ifNull: [ { $arrayElemAt: [ '$storeFixtureDetails.planoId', 0 ] }, [] ] },
        },
      },
      {
        $lookup: {
          from: 'planograms',
          let: { planoIds: '$planoId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [ '$_id', { $ifNull: [ '$$planoIds', [] ] } ],
                },
              },
            },
            {
              $group: {
                _id: null,
                statusList: { $addToSet: '$status' },
              },
            },
          ],
          as: 'planoStatus',
        },
      },
      {
        $project: {
          fixtureCategory: 1,
          fixtureName: 1,
          fixtureWidth: 1,
          productBrandName: 1,
          productCategory: 1,
          clientId: 1,
          fixtureType: 1,
          productSubCategory: 1,
          status: 1,
          templateId: 1,
          planoId: 1,
          vmCapacity: 1,
          productCapacity: 1,
          planoStatus: { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] },
          status: {
            $cond: {
              if: { $in: [ 'completed', { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] } ] },
              then: 'active',
              else: {
                $cond: {
                  if: {
                    $eq: [
                      '$status', 'draft',
                    ],
                  },
                  then: 'draft',
                  else: 'inactive',
                },
              },
            },
          },
        },
      },
    ];

    if ( req.body.filter.status.length ) {
      query.push( {
        $match: {
          status: { $in: req.body.filter.status },
        },
      } );
    }

    if ( req.body?.sortColumnName && req.body?.sortBy ) {
      query.push( {
        $sort: {
          [req.body.sortColumnName]: req.body.sortBy,
        },
      },
      );
    } else {
      query.push( {
        $sort: { _id: -1 },
      } );
    }
    query.push(
        {
          $facet: {
            ...( !req.body?.export ) ? {
              templateData: [ { $skip: skip }, { $limit: limit } ],
            } : { templateData: [ { $skip: skip } ] },
            count: [ { $count: 'total' } ],
          },
        },
    );
    let fixtureDetails = await fixtureConfigService.aggregate( query );
    if ( !fixtureDetails[0]?.templateData.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      count: fixtureDetails[0].count[0].total,
      data: fixtureDetails[0].templateData,
    };
    return res.sendSuccess( result );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'getTemplateList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateFixtureTask( req, res ) {
  try {
    let storeList = req.body.storeList.map( ( ele ) => ele.toLowerCase() );
    let query = [
      {
        $addFields: {
          storeLower: { $toLower: '$storeName' },
        },
      },
      {
        $match: {
          clientId: req.body.clientId,
          status: 'active',
          storeLower: { $in: storeList },
        },
      },
    ];
    let storeDetails = await storeService.aggregate( query );
    if ( !storeDetails.length ) {
      return res.sendError( 'No date found', 204 );
    }
    storeList = storeDetails.map( ( ele ) => {
      return { store: ele.storeName, email: ele?.spocDetails?.[0]?.email };
    } );
    let fixtureTaskStore = [];
    let layoutTaskStore = [];
    await Promise.all( storeList.map( async ( ele ) => {
      let getTaskDetails = await processedTaskService.findOne( { storeName: ele.store, userEmail: ele.email, isPlano: true, date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ), type: 'layout' } );
      if ( getTaskDetails && getTaskDetails.planoType == 'layout' && getTaskDetails.checklistStatus == 'submit' ) {
        fixtureTaskStore.push( ele );
      } else {
        layoutTaskStore.push( ele );
      }
    } ) );
    let currDate = dayjs();
    let endDate = dayjs( req.body.endDate, 'YYYY-MM-DD' );
    let todayDate = currDate.format( 'YYYY-MM-DD' ) == endDate.format( 'YYYY-MM-DD' );
    let data = [
      'Fixture Verification',
      'Layout Verification',
    ];
    await Promise.all( data.map( async ( ele ) => {
      req.body = {
        clientId: req.body.clientId,
        stores: ele.includes( 'Fixture' ) ? fixtureTaskStore : layoutTaskStore,
        days: todayDate ? 1 : endDate.diff( currDate, 'day' ) + 2,
        checkListName: ele,
        geoFencing: req.body.geoFencing,
        endTime: req.body.endTime,
      };
      if ( req.body.stores.length ) {
        await createTask( req, res );
      }
    } ) );
  } catch ( e ) {
    logger.error( { functionName: 'updateFixtureTask', error: e } );
  }
}

export async function getAllTemplates( req, res ) {
  try {
    if ( !req.body.clientId ) {
      return res.sendError( 'Client Id is required', 400 );
    }

    const fixtureTemplates = await fixtureConfigService.find( { clientId: req.body.clientId }, { fixtureName: 1, fixtureWidth: 1, productBrandName: 1 } );

    res.sendSuccess( fixtureTemplates );
  } catch ( e ) {
    logger.error( { functionName: 'getAllTemplates', error: e } );
  }
}
