// import { writeFileSync } from 'fs';
import xlsx from 'xlsx';
import { logger, fileUpload } from 'tango-app-api-middleware';
import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as planoProductService from '../service/planoProduct.service.js';
import * as planoVmService from '../service/planoVm.service.js';
import * as planoMappingService from '../service/planoMapping.service.js';
import * as planoTaskService from '../service/planoTask.service.js';
import * as processedTaskService from '../service/processedTaskservice.js';
// import * as planoComplianceService from '../service/planoCompliance.service.js';
// import * as planoTaskComplianceService from '../service/planoTask.service.js';
// import * as planoQrConversionRequestService from '../service/planoQrConversionRequest.service.js';
import * as planoProductCategoryService from '../service/planoproductCategory.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as fixtureLibraryService from '../service/planoLibrary.service.js';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import { signedUrl } from 'tango-app-api-middleware';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

import dayjs from 'dayjs';
import timeZone from 'dayjs/plugin/timezone.js';
dayjs.extend( timeZone );


export async function getStoreNames( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Excel file is required', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Layout,Fixture&VM Mapping (1705';
    const raw = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const storeNames = new Set();
    raw.forEach( ( item ) => {
      storeNames.add( item?.['Store ID'] );
    } );

    const storeNamesArray = Array.from( storeNames );
    return res.sendSuccess( { storeNames: storeNamesArray, length: storeNamesArray.length } );
  } catch ( e ) {
    logger.error( { functionName: 'getStoreNames', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function createFixtureConfig( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Fixture Library';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const inputArray = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const transformedData = inputArray.map( ( item ) => {
      const sectionDetailsRaw = item['Section details'];
      const proportionRaw = item['Proportion'];

      const availableSections = typeof sectionDetailsRaw === 'string' ?
        sectionDetailsRaw.replace( /[{}]/g, '' ).split( ', ' ).map( ( s ) => s.trim() ) :
        [];

      const proportions = typeof proportionRaw === 'string' ?
        proportionRaw.replace( /[{}%]/g, '' ).split( ', ' ).map( ( num ) => parseInt( num.trim(), 10 ) ) :
        [];

      const sectionNames = [ 'Top', 'Mid', 'Bottom' ];
      const sectionKeys = [ 'Top_Section', 'Middle_Section', 'Bottom_Section' ];

      const sections = availableSections.map( ( section, index ) => {
        const sectionIndex = sectionNames.indexOf( section );
        return {
          sectionId: section,
          sectionName: sectionKeys[sectionIndex],
          sectionShelves: item[sectionKeys[sectionIndex]],
          proportion: proportions[index] !== undefined ? proportions[index] : null,
        };
      } );


      return {
        clientId: '11',
        fixtureCategory: item['Fixture Category'],
        fixtureLength: {
          value: typeof item['Fixture Length(ft)'] === 'number' ? item['Fixture Length(ft)'] : 0,
          unit: 'ft',
        },
        shelfCount: typeof item['No. of Shelves'] === 'number' ? item['No. of Shelves'] : undefined,
        productPerShelf: typeof item['No. of Spots on Shelf'] === 'number' ? item['No. of Spots on Shelf'] : undefined,
        fixtureCapacity: typeof item['Capacity on Fixture'] === 'number' ? item['Capacity on Fixture'] : undefined,
        sections,
        fixtureCode: item['Fixture Code '].trim(),
        fixtureConfigType: item['Fixture Type'],
      };
    } );

    await fixtureConfigService.insertMany( transformedData );
    return res.sendSuccess( { message: 'Data inserted successfully', length: transformedData.length } );
  } catch ( e ) {
    logger.error( { functionName: 'transformDataAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}


export async function createPlano( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Layout,Fixture&VM';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const raw = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );
    const storeNames = new Set();

    raw.forEach( ( item ) => {
      storeNames.add( item?.['Store ID'] );
    } );

    const storeNamesArray = Array.from( storeNames );

    for ( const store of storeNamesArray ) {
      const storeData = await storeService.findOne( { storeName: store } );

      const planoInsertData = {
        storeName: store,
        storeId: storeData?.toObject()?.storeId ? storeData.toObject().storeId : 'nil',
        layoutName: `${store} - Layout`,
        clientId: '11',
        attachments: [],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        floorNumber: 1,
        productResolutionLevel: 'L2',
        scanType: 'qr',
      };

      console.log( planoInsertData );

      await planoService.create( planoInsertData );
    }

    return res.sendSuccess( { message: 'Plano data inserted successfully', length: storeNamesArray.length } );
  } catch ( e ) {
    logger.error( { functionName: 'createPlanoAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function createFloors( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Layout,Fixture&VM';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const rawData = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const groupedData = {};

    rawData.forEach( ( item ) => {
      const fixtureId = item['Store Fixture ID'];

      if ( !groupedData[fixtureId] ) {
        groupedData[fixtureId] = {
          'Store ID': item['Store ID'],
          'Store Fixture ID': fixtureId,
          'Fixture ID': item['Fixture ID ( For ref only)'],
          'Fixture Category': item['Fixture Category'],
          'Fixture Size (feet)': item['Fixture Size (feet)'],
          'Fixture Count': item['Fixture Count'],
          'Effective Fixture Count': item['Effective Fixture Count'],
          'Capacity': item['Capacity'],
          'Store Fixture Locator': item['Store Fixture Locator'],
          'Wall': item['Wall'],
          'Brand-Category': item['Brand-Category'],
          'Brand - Sub Category': item['Brand - Sub Category'],
          'VM Template ID': item['VM Template ID '],
          'categories': [],
        };
      }

      const categories = groupedData[fixtureId]['categories'];
      const existingCategory = categories.find( ( cat ) => cat['Zone'] === item['Section Allocation '] );

      if ( !existingCategory ) {
        categories.push( {
          'Allocation': item['Shelf Allocation'],
          'Zone': item['Section Allocation '],
        } );
      }
    } );

    const raw = Object.values( groupedData );

    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    const storeList = await planoService.find( {} );

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    await Promise.all( storeList.map( async ( store ) => {
      const planoDoc = store.toObject();
      const leftFixtures = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Left' );
      const rightFixtures = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Right' );
      const floorFixtures = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Centre' );
      const backFixtures = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Back' );

      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length > 4 ? 3 : 2;
      const totalRows = Math.ceil( floorFixtures.length / maxFixturesPerRow );
      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( totalRows * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( totalRows * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );


      const finalXDistance = maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance;
      const finalXDetailedDistance = maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance;

      const finalYDistance = maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) );
      const finalYDetailedDistance = maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) );

      const floorInsertData = {
        storeName: planoDoc.storeName,
        storeId: planoDoc.storeId,
        layoutName: `${planoDoc.storeName} - Layout`,
        clientId: '11',
        floorNumber: 1,
        floorName: 'floor 1',
        layoutPolygon: [
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalYDistance,
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: finalYDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
          {
            elementType: 'entrance',
            distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
        ],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        planoId: planoDoc._id,
      };

      await storeBuilderService.create( floorInsertData );

      console.log( floorInsertData );
    } ) );

    return res.sendSuccess( { message: 'Floor data inserted successfully' } );
  } catch ( e ) {
    logger.error( { functionName: 'addFloorDataAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}


export async function createFixturesShelves( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Layout,Fixture&VM';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const rawData = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const groupedData = {};

    rawData.forEach( ( item ) => {
      const fixtureId = item['Store Fixture ID'];

      if ( !groupedData[fixtureId] ) {
        groupedData[fixtureId] = {
          'Store ID': item['Store ID'],
          'Store Fixture ID': fixtureId,
          'Fixture ID': item['Fixture ID ( For ref only)'],
          'Fixture Category': item['Fixture Category'],
          'Fixture Size (feet)': item['Fixture Size (feet)'],
          'Fixture Count': item['Fixture Count'],
          'Effective Fixture Count': item['Effective Fixture Count'],
          'Capacity': item['Capacity'],
          'Store Fixture Locator': item['Store Fixture Locator'],
          'Wall': item['Wall'],
          'Brand-Category': item['Brand-Category'],
          'Brand - Sub Category': item['Brand - Sub Category'],
          'VM Template ID': item['VM Template ID '],
          'categories': [],
        };
      }

      const categories = groupedData[fixtureId]['categories'];
      const existingCategory = categories.find( ( cat ) => cat['Zone'] === item['Section Allocation '] );

      if ( !existingCategory ) {
        categories.push( {
          'Allocation': item['Shelf Allocation'],
          'Zone': item['Section Allocation '],
        } );
      }
    } );

    const raw = Object.values( groupedData );

    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;


    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;


    const mmToFeet = 305;
    const layoutList = await storeBuilderService.find( {} );

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    for ( let i = 0; i < layoutList.length; i++ ) {
      const layout = layoutList[i];

      const layoutDoc = layout.toObject();

      const leftFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Left' );
      const rightFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Right' );
      const floorFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Centre' );
      const backFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Back' );

      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length > 4 ? 3 : 2;
      const totalRows = Math.ceil( floorFixtures.length / maxFixturesPerRow );
      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( totalRows * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( totalRows * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

      const finalXDistance = maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance;
      const finalXDetailedDistance = maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance;

      const finalYDistance = maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) );
      const finalYDetailedDistance = maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) );


      let fixtureCounter = 1;

      for ( let index = 0; index < leftFixtures.length; index++ ) {
        const fixture = leftFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 1,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );

        console.log( 'Fixture Data', fixtureData );


        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }


        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );

            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;


              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };


              await fixtureShelfService.create( shelfData );

              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < backFixtures.length; index++ ) {
        const fixture = backFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 2,
          'relativePosition': {
            'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( finalXDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );

        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }

        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              await fixtureShelfService.create( shelfData );

              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < rightFixtures.length; index++ ) {
        const fixture = rightFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 3,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );

        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }

        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              await fixtureShelfService.create( shelfData );
              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < floorFixtures.length; index++ ) {
        const fixture = floorFixtures[index];

        const centerRow = Math.floor( totalRows / 2 );

        const startingX =roundToTwo( ( ( finalXDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) ) );
        const detailedStartingX = roundToTwo( ( ( finalXDetailedDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ) );

        const startingY = ( finalYDistance / 2 ) - ( centerRow * ( constantFixtureWidth / mmToFeet ) );
        const detailedStartingY = ( finalYDetailedDistance / 2 ) - ( centerRow * ( constantDetailedFixtureWidth / mmToFeet ) );

        const rowIndex = Math.floor( index / maxFixturesPerRow );
        const colIndex = index % maxFixturesPerRow;

        const xPos = roundToTwo( ( startingX + colIndex * ( constantFixtureLength / mmToFeet ) ) );
        const yPos = roundToTwo( ( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) ) );

        const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
        const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'floor',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': xPos,
            'y': yPos,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': detailedXPos,
            'y': detailedYPos,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );
        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }


        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              await fixtureShelfService.create( shelfData );

              shelfIndex++;
            }
          }
        }
      }
    }


    return res.sendSuccess( 'Updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'createFixturesShelves', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateFixturesShelves( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Layout,Fixture&VM';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const rawData = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const groupedData = {};

    rawData.forEach( ( item ) => {
      const fixtureId = item['Store Fixture ID'];

      if ( !groupedData[fixtureId] ) {
        groupedData[fixtureId] = {
          'Store ID': item['Store ID'],
          'Store Fixture ID': fixtureId,
          'Fixture ID': item['Fixture ID ( For ref only)'],
          'Fixture Category': item['Fixture Category'],
          'Fixture Size (feet)': item['Fixture Size (feet)'],
          'Fixture Count': item['Fixture Count'],
          'Effective Fixture Count': item['Effective Fixture Count'],
          'Capacity': item['Capacity'],
          'Store Fixture Locator': item['Store Fixture Locator'],
          'Wall': item['Wall'],
          'Brand-Category': item['Brand-Category'],
          'Brand - Sub Category': item['Brand - Sub Category'],
          'VM Template ID': item['VM Template ID '],
          'categories': [],
          'fixtureNumber': item['fixtureNumber'],
        };
      }

      const categories = groupedData[fixtureId]['categories'];
      const existingCategory = categories.find( ( cat ) => cat['Zone'] === item['Section Allocation '] );

      if ( !existingCategory ) {
        categories.push( {
          'Allocation': item['Shelf Allocation'],
          'Zone': item['Section Allocation '],
        } );
      }
    } );

    const raw = Object.values( groupedData );

    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;


    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;


    const mmToFeet = 305;
    const layoutList = await storeBuilderService.find( {} );

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    for ( let i = 0; i < layoutList.length; i++ ) {
      const layout = layoutList[i];

      const layoutDoc = layout.toObject();

      const leftFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Left' );
      const rightFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Right' );
      const floorFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Centre' );
      const backFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Back' );

      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length > 4 ? 3 : 2;
      const totalRows = Math.ceil( floorFixtures.length / maxFixturesPerRow );
      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( totalRows * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( totalRows * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

      const finalXDistance = maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance;
      const finalXDetailedDistance = maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDistance;

      const finalYDistance = maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) );
      const finalYDetailedDistance = maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) );


      let fixtureCounter = 1;

      for ( let index = 0; index < leftFixtures.length; index++ ) {
        const fixture = leftFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 1,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.findOneAndUpdate2( { storeName: layoutDoc.storeName, fixtureNumber: fixture?.['fixtureNumber'] }, { fixtureCode: fixture?.['Fixture ID'] } );

        console.log( 'Fixture Data', fixtureData );


        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }


        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );

            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;


              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };


              await fixtureShelfService.create( shelfData );

              // console.log( 'Shelf Data:', createdShelf );

              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < backFixtures.length; index++ ) {
        const fixture = rightFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 2,
          'relativePosition': {
            'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( finalXDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.findOneAndUpdate2( { storeName: layoutDoc.storeName, fixtureNumber: fixture?.['fixtureNumber'] }, { fixtureCode: fixture?.['Fixture ID'] } );

        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }

        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              const createdShelf = await fixtureShelfService.create( shelfData );

              console.log( 'Shelf Data:', createdShelf );

              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < rightFixtures.length; index++ ) {
        const fixture = rightFixtures[index];

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 3,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.findOneAndUpdate2( { storeName: layoutDoc.storeName, fixtureNumber: fixture?.['fixtureNumber'] }, { fixtureCode: fixture?.['Fixture ID'] } );

        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }

        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              await fixtureShelfService.create( shelfData );

              // console.log( 'Shelf Data:', createdShelf );

              shelfIndex++;
            }
          }
        }
      }

      for ( let index = 0; index < floorFixtures.length; index++ ) {
        const fixture = floorFixtures[index];

        const centerRow = Math.floor( totalRows / 2 );

        const startingX =roundToTwo( ( ( finalXDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) ) );
        const detailedStartingX = roundToTwo( ( ( finalXDetailedDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ) );

        const startingY = ( finalYDistance / 2 ) - ( centerRow * ( constantFixtureWidth / mmToFeet ) );
        const detailedStartingY = ( finalYDetailedDistance / 2 ) - ( centerRow * ( constantDetailedFixtureWidth / mmToFeet ) );

        const rowIndex = Math.floor( index / maxFixturesPerRow );
        const colIndex = index % maxFixturesPerRow;

        const xPos = roundToTwo( ( startingX + colIndex * ( constantFixtureLength / mmToFeet ) ) );
        const yPos = roundToTwo( ( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) ) );

        const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
        const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureCategory': fixture?.['Fixture Category'] ? fixture?.['Fixture Category'] : 'nil',
          'fixtureBrandCategory': fixture?.['Brand-Category'] ? fixture?.['Brand-Category'] : 'nil',
          'fixtureBrandSubCategory': fixture?.['Brand - Sub Category'] ? fixture?.['Brand - Sub Category'] : 'nil',
          'fixtureCode': fixture?.['Fixture ID'],
          'fixtureCapacity': fixture?.['Capacity'],
          'fixtureType': 'floor',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': xPos,
            'y': yPos,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter++,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': detailedXPos,
            'y': detailedYPos,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.findOneAndUpdate2( { storeName: layoutDoc.storeName, fixtureNumber: fixture?.['fixtureNumber'] }, { fixtureCode: fixture?.['Fixture ID'] } );
        console.log( 'Fixture Data', fixtureData );

        const vms = typeof fixture?.['VM Template ID'] === 'string' ? fixture?.['VM Template ID']?.split( ', ' ).map( ( item ) => item.trim() ) : [];

        for ( let i = 0; i < vms?.length; i++ ) {
          const vmTemplate = await planoProductService.findOne( { productId: vms[i] } );

          if ( vmTemplate ) {
            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.create( vmData );
          }
        }


        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCode: fixture?.['Fixture ID'] } );

        if ( fixtureConfig ) {
          let shelfIndex = 0;

          for ( const section of fixtureConfig.sections ) {
            const storeCategory = fixture.categories.find( ( cat ) => cat.Zone === section.sectionId );
            for ( let j = 0; j < section.sectionShelves; j++ ) {
              if ( shelfIndex >= fixtureConfig.shelfCount ) break;

              const shelfData = {
                'clientId': fixtureConfig.clientId,
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': shelfIndex + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': fixtureConfig.productPerShelf,
                'sectionName': storeCategory ? storeCategory?.['Allocation'] : 'Unknown',
                'sectionZone': section.sectionId,
              };

              await fixtureShelfService.create( shelfData );

              // console.log( 'Shelf Data:', createdShelf );

              shelfIndex++;
            }
          }
        }
      }
    }


    return res.sendSuccess( 'Updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'createFixturesShelves', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function createVmData( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'VM Library';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const inputArray = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );


    const transformedData = inputArray.map( ( item ) => {
      console.log( item );

      return {
        'clientId': '11',
        'productId': item['VM ID'],
        'type': 'vm',
        'productName': item['VM Categories '],
        'productHeight': {
          'value': typeof item?.['VM Height mm'] === 'number' ? item?.['VM Height mm'] : 0,
          'unit': 'mm',
        },
        'productWidth': {
          'value': typeof item?.['VM Width mm'] === 'number' ? item?.['VM Width mm'] : 0,
          'unit': 'mm',
        },
        'startYPosition': typeof item?.['StartPosition '] === 'number' ? item?.['StartPosition '] : 0,
        'endYPosition': typeof item?.['End Position'] === 'number' ? item?.['End Position'] : 0,
        'xZone': item?.['Start Zone '],
      };
    } );

    await planoProductService.insertMany( transformedData );
    return res.sendSuccess( { message: 'Data inserted successfully', length: transformedData.length } );
  } catch ( e ) {
    logger.error( { functionName: 'transformDataAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function lk98lK1993Update( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    const modelFixture = await storeFixtureService.findOne( { storeName: 'LKST98', fixtureNumber: 1 } );

    const modelShelves = await fixtureShelfService.find( { fixtureId: modelFixture.toObject()._id } );

    const modelproducts = await planoMappingService.find( { fixtureId: modelFixture.toObject()._id, type: 'product' } );

    const stores = [ 'LKST1193' ];

    for ( let i = 0; i < stores.length; i++ ) {
      const store = stores[i];

      const storeFixtures = await storeFixtureService.find( { storeName: store, fixtureType: { $ne: 'other' } } );

      for ( let j = 0; j < storeFixtures.length; j++ ) {
        const fixture = storeFixtures[j].toObject();

        for ( let k = 0; k < modelShelves.length; k++ ) {
          const modelShelf = modelShelves[k].toObject();

          delete modelShelf._id;

          const updateShelfData = {
            ...modelShelf,
            fixtureId: fixture._id,
            storeName: 'LKST1193',
            storeId: '11-1076',
            planoId: new mongoose.Types.ObjectId( '67c1a273dad5d3cfdbf18fe3' ),
            floorId: new mongoose.Types.ObjectId( '67c1a2a8dad5d3cfdbf1c9f5' ),
          };

          const createdShelf = await fixtureShelfService.create( updateShelfData );
          console.log( updateShelfData );

          for ( let l = 0; l < modelproducts.length; l++ ) {
            const modelProduct = modelproducts[l].toObject();

            delete modelProduct._id;

            const updateProductData = {
              ...modelProduct,
              fixtureId: fixture._id,
              shelfId: createdShelf.toObject()._id,
              storeName: 'LKST1193',
              storeId: '11-1076',
              planoId: new mongoose.Types.ObjectId( '67c1a273dad5d3cfdbf18fe3' ),
              floorId: new mongoose.Types.ObjectId( '67c1a2a8dad5d3cfdbf1c9f5' ),
            };

            await planoMappingService.create( updateProductData );
            console.log( updateProductData );
          }
        }
      }
    }
    return res.sendSuccess( 'Updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'transformDataAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateInventory( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Invalid or missing Excel file', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Sheet1';
    if ( !workbook.Sheets[sheetName] ) {
      return res.sendError( `Sheet "${sheetName}" not found`, 400 );
    }

    const raw = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    for ( let i = 0; i < raw.length; i++ ) {
      const element = raw[i];

      const updateData = {
        productBrand: element.parent_brand,
        productType: element.parent_category,
        productId: element.barcode,
        type: 'product',
        storeName: 'LKST1193',
        clientId: '11',
      };

      console.log( updateData );

      const product = await planoProductService.create( updateData );
      console.log( product );
    }


    return res.sendSuccess( { message: 'Product inventory updated successfully' } );
  } catch ( e ) {
    logger.error( { functionName: 'createPlanoAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateRfidProduct( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    const productMappings = await planoMappingService.find( { fixtureId: req.body.fixtureId } );

    console.log( productMappings );

    for ( let i = 0; i < productMappings.length; i++ ) {
      const mapping = productMappings[i].toObject();

      const product = await planoProductService.findOne( { productId: mapping.rfId } );

      if ( product ) {
        await planoMappingService.updateOne( { _id: mapping._id }, { productId: product.toObject()._id } );
      }

      console.log( product );
    }


    return res.sendSuccess( { message: 'Product inventory updated successfully' } );
  } catch ( e ) {
    logger.error( { functionName: 'createPlanoAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateRfidProduct2( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    const data = req.body.data;

    for ( let i = 0; i < data.length; i++ ) {
      const section = data[i];

      for ( let j = 0; j < section.products.length; j++ ) {
        const product = section.products[j];

        const productDetail = await planoProductService.findOne( { productId: product.qr } );

        if ( productDetail ) {
          await planoMappingService.updateOne( { rfId: product.rfId }, { productId: productDetail.toObject()._id } );
        }

        console.log( productDetail );
      }
    }


    return res.sendSuccess( { message: 'Product inventory updated successfully' } );
  } catch ( e ) {
    logger.error( { functionName: 'createPlanoAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function getProdTaskData( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }


    const planoData = await planoService.findOne( { storeName: req.body.store } );

    let fixtureDetails = await planoTaskService.find( { planoId: planoData.toObject()._id, type: req.body.type } );
    if ( !fixtureDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    return res.sendSuccess( fixtureDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getProdTaskData', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function extractZipFileNames( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    if ( !req.files.file ) {
      return res.sendError( 'No file uploaded', 400 );
    }

    const zip = new JSZip();
    const zipContents = await zip.loadAsync( req.files.file.data );

    const fileNames = Object.keys( zipContents.files );

    return res.sendSuccess( { fileNames } );
  } catch ( e ) {
    logger.error( { functionName: 'extractZipFileNames', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updatelayoutFeedback( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    const layoutFeedbacks = await planoTaskService.find( { type: 'layout' } );

    for ( let i = 0; i < layoutFeedbacks.length; i++ ) {
      const layoutDoc = layoutFeedbacks[i].toObject();

      const [ q1, q2, q3 ] = layoutDoc.answers;
      console.log( q3 );

      if ( q1.value === false ) {
        const floor = await storeBuilderService.findOne( { _id: layoutDoc.floorId } );

        const floorDoc = floor.toObject();

        const fixtures = await storeFixtureService.find( { floorId: floorDoc._id } );

        const constantFixtureLength = 1220;
        const constantDetailedFixtureLength = 1220;

        const constantFixtureWidth = 610;
        const constantDetailedFixtureWidth = 1524;

        const mmToFeet = 305;


        function roundToTwo( num ) {
          return Math.round( num * 100 ) / 100;
        }

        const leftFixtures = fixtures.filter( ( fixture ) => fixture.toObject().associatedElementType === 'wall' && fixture.toObject().associatedElementNumber === 1 && fixture.toObject().fixtureType === 'wall' );
        const rightFixtures = fixtures.filter( ( fixture ) => fixture.toObject().associatedElementType === 'wall' && fixture.toObject().associatedElementNumber === 3 && fixture.toObject().fixtureType === 'wall' );
        const floorFixtures = fixtures.filter( ( fixture ) => fixture.toObject().fixtureType === 'floor' );
        const backFixtures = fixtures.filter( ( fixture ) => fixture.toObject().associatedElementType === 'wall' && fixture.toObject().associatedElementNumber === 2 && fixture.toObject().fixtureType === 'wall' );

        q2.correctedFixture.forEach( ( cf ) => {
          switch ( cf.alignment ) {
            case 'Wall 1':
              leftFixtures.push( {} );
              break;
            case 'Wall 2':
              backFixtures.push( {} );
              break;
            case 'Wall 3':
              rightFixtures.push( {} );
              break;
            case 'centre':
              floorFixtures.push( {} );
              break;

            default:
              break;
          }
        } );


        const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
        const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

        const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

        const maxFixturesPerRow = floorFixtures.length > 4 ? 3 : 2;
        const totalRows = Math.ceil( floorFixtures.length / maxFixturesPerRow );
        const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( maxFixturesPerRow * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

        const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( totalRows * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
        const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( totalRows * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

        const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

        const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
        const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

        const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
        const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

        const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
        const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );


        const finalXDistance = maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance;
        const finalXDetailedDistance = maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance;

        const finalYDistance = maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) );
        const finalYDetailedDistance = maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) );

        const layoutPolygon = [
          {
            elementType: 'wall',
            distance: roundToTwo( finalXDistance ),
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( finalXDetailedDistance ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( finalYDistance ),
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: roundToTwo( finalYDetailedDistance ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( finalXDistance ),
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: roundToTwo( finalXDetailedDistance ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
          {
            elementType: 'entrance',
            distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
        ];

        await storeBuilderService.updateOne( { _id: floorDoc._id }, { layoutPolygon: layoutPolygon } );

        console.log( layoutPolygon, floorDoc._id );
      }
    }
  } catch ( e ) {
    logger.error( { functionName: 'updatelayoutFeedback', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateFixtureFeedback( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    if ( !req.body.length ) {
      return res.sendError( 'Store List is required', 400 );
    }

    const storeList = req.body;

    for ( let i = 0; i < storeList.length; i++ ) {
      const store = storeList[i];

      // const issueTypes = [
      //   'Fixture size is wrong',
      //   'Fixture type is wrong',
      //   'Fixture brand is wrong',
      //   'Fixture not in the store',
      //   'Shelves count/Product Category/Capacity is wrong',
      //   'Others',
      // ];

      const planogram = await planoService.findOne( { storeName: store.storeName } );

      const fixtureTaskList = await planoTaskService.find( { planoId: planogram.toObject()._id, type: 'fixture', date_string: store.date } );

      for ( let j = 0; j < fixtureTaskList.length; j++ ) {
        const fixtureTask = fixtureTaskList[j].toObject();

        const [ q1 ] = fixtureTask.answers;

        if ( q1.value === true ) {
          continue;
        }

        const fixture = await storeFixtureService.findOne( { _id: fixtureTask.fixtureId } );

        const fixtureDoc = fixture?.toObject();

        if ( q1.issues.includes( 'Fixture size is wrong' ) ) {
          const fixtureConfig = await fixtureConfigService.findOne( { 'fixtureLength.value': q1.data.fixtureSize.value } );

          if ( fixtureConfig && fixtureConfig.toObject()?.fixtureCode ) {
            await storeFixtureService.updateOne( { _id: fixtureDoc._id }, { fixtureCode: fixtureConfig.toObject().fixtureCode } );
          }
        }

        if ( q1.issues.includes( 'Fixture type is wrong' ) ) {
          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: q1.data.fixtureType } );

          if ( fixtureConfig && fixtureConfig.toObject().fixtureCode ) {
            await storeFixtureService.updateOne( { _id: fixtureDoc._id }, { fixtureCode: fixtureConfig.toObject().fixtureCode } );
          }
        }

        if ( q1.issues.includes( 'Fixture brand is wrong' ) ) {
          const fixtureBrand = q1.data.fixtureBrand;

          if ( fixtureBrand?.length ) {
            const formattedfixtureBrand = fixtureBrand.length ? ( fixtureBrand.length > 1 ? fixtureBrand.join( ' + ' ) : fixtureBrand[0] ) : undefined;

            await storeFixtureService.updateOne( { _id: fixtureDoc._id }, { fixtureName: formattedfixtureBrand, fixtureBrandCategory: formattedfixtureBrand } );
          }
        }

        if ( q1.issues.includes( 'Fixture not in the store' ) ) {
          await storeFixtureService.deleteOne( { _id: fixtureDoc._id } );
          await fixtureShelfService.deleteMany( { fixtureId: fixtureDoc._id } );
          await planoMappingService.deleteMany( { fixtureId: fixtureDoc._id } );
        }


        if ( q1.issues.includes( 'Shelves count/Product Category/Capacity is wrong' ) ) {
          const taskShelves = q1.data.shelves;

          const fixtureShelves = await fixtureShelfService.findAndSort( { fixtureId: fixtureTask.fixtureId }, {}, { shelfNumber: 1 } );

          const shelfCount = q1.data.shelves.length;

          const fixtureCapacity = q1.data.shelves.reduce( ( sum, item ) => sum + ( item.productCapacity ? item.productCapacity : 0 ), 0 );

          const updateFixture = await storeFixtureService.updateOne( { _id: fixtureDoc._id }, { shelfcount: shelfCount, fixtureCapacity: fixtureCapacity } );

          console.log( updateFixture );

          for ( let k = 0; k < taskShelves.length; k++ ) {
            const taskShelf = taskShelves[k];
            const productCapacity = taskShelf.productCapacity;
            const section = taskShelf.section;
            const subBrand = taskShelf.subBrand;
            const formattedsubBrand = subBrand.length ? ( subBrand.length > 1 ? subBrand.join( ' + ' ) : subBrand[0] ) : undefined;

            if ( taskShelves.length === fixtureShelves.length ) {
              const fixtureShelf = fixtureShelves.filter( ( shelf ) => {
                return shelf.toObject().shelfNumber === k+1;
              } );

              const updateShelf = await fixtureShelfService.updateOne( { _id: fixtureShelf?.[0].toObject()._id }, { shelfCapacity: productCapacity, sectionName: formattedsubBrand, sectionZone: section } );

              console.log( updateShelf );
            } else if ( taskShelves.length < fixtureShelves.length ) {
              const fixtureShelf = fixtureShelves.filter( ( shelf ) => {
                return shelf.toObject().shelfNumber === k+1;
              } );

              const updateShelf = await fixtureShelfService.updateOne( { _id: fixtureShelf?.[0].toObject()._id }, { shelfCapacity: productCapacity, sectionName: formattedsubBrand, sectionZone: section } );

              console.log( updateShelf );

              const shelfDifference = fixtureShelves.length - taskShelves.length;

              const shelvesToDelete = fixtureShelves.slice( -shelfDifference );

              shelvesToDelete.map( async ( shelf ) => {
                await fixtureShelfService.deleteOne( { _id: shelf.toObject()._id } );
                await planoMappingService.deleteMany( { shelfId: shelf.toObject()._id } );
              } );
            } else if ( taskShelves.length > fixtureShelves.length ) {
              if ( k + 1 <= fixtureShelves.length ) {
                const fixtureShelf = fixtureShelves.filter( ( shelf ) => {
                  return shelf.toObject().shelfNumber === k+1;
                } );


                const updateShelf = await fixtureShelfService.updateOne( { _id: fixtureShelf?.[0].toObject()._id }, { shelfCapacity: productCapacity, sectionName: formattedsubBrand, sectionZone: section } );

                console.log( updateShelf );
              } else if ( k + 1 > fixtureShelves.length ) {
                const insertData = {
                  'clientId': planogram.toObject().clientId,
                  'storeName': planogram.toObject().storeName,
                  'storeId': planogram.toObject().storeId,
                  'planoId': planogram.toObject()._id,
                  'floorId': fixtureDoc.floorId,
                  'fixtureId': fixtureDoc._id,
                  'shelfNumber': k+1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': productCapacity,
                  'sectionName': formattedsubBrand,
                  'sectionZone': section,
                };


                await fixtureShelfService.create( insertData );
              }
            }
          }
        }
      }

      const vmTaskList = await planoTaskService.find( { planoId: planogram.toObject()._id, type: 'vm', date_string: store.date } );

      for ( let j = 0; j < vmTaskList.length; j++ ) {
        const vmTask = vmTaskList[j].toObject();

        const [ q1, q2 ] = vmTask.answers;
        console.log( q2 );

        if ( q1.value ) continue;

        const removeVms = q1.selectedVMs.forEach( async ( vmId ) => {
          if ( !vmId ) return;
          const vmObjectId = new mongoose.Types.ObjectId( vmId );

          const deletedVm = await planoMappingService.deleteOne( { _id: vmObjectId } );

          return deletedVm;
        } );

        console.log( removeVms, 'removed vms' );

        const newVms = q1.newVmsType.forEach( async ( vmType ) => {
          const vm = await planoProductService.findOne( { type: 'vm', productName: vmType } );

          if ( !vm ) return;

          const insertData = {
            'clientId': planogram.toObject().clientId,
            'storeName': planogram.toObject().storeName,
            'storeId': planogram.toObject().storeId,
            'type': 'vm',
            'planoId': planogram.toObject()._id,
            'floorId': vmTask.floorId,
            'fixtureId': vmTask.fixtureId,
            'productId': vm.toObject()._id,
          };

          const insertedVm = await planoMappingService.create( insertData );

          return insertedVm;
        } );

        console.log( newVms, 'new vms' );
      }
    }

    res.sendSuccess( 'Updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateFixtureFeedback', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function getVmTaskData( req, res ) {
  try {
    const { storeName, date } = req.body;

    const planogram = await planoService.findOne( { storeName: storeName } );

    const vmTaskList = await planoTaskService.find( { planoId: planogram.toObject()._id, type: 'vm', date_string: date } );

    if ( !vmTaskList?.length ) {
      return res.sendError( 'No data', 204 );
    }

    const storefixtures = await storeFixtureService.findAndSort( { planoId: planogram.toObject()._id, fixtureType: { $ne: 'other' } }, { fixtureName: 1, fixtureNumber: 1, _id: 1 }, { fixtureNumber: 1 } );

    const fixtureVmData = await Promise.all(
        storefixtures.map( async ( fixture ) => {
          const fixtureDoc = fixture.toObject();
          const vmTasks = await planoTaskService.find( { fixtureId: fixture._id, type: 'vm' } );

          const q2 = vmTasks[0].toObject().answers?.[1];

          const params = {
            Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
            file_path: q2?.image || null,
          };

          const fixtureImage = await signedUrl( params );

          const vmTaskData = await Promise.all(
              vmTasks.flatMap( ( task ) => {
                const q1 = task.toObject().answers?.[0];

                if ( !q1?.newVmsType || !q1?.newVms ) return [];

                return q1.newVmsType.map( async ( vmtype, k ) => {
                  const params = {
                    Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                    file_path: q1.newVms[k]?.imageUrl || null,
                  };
                  const signedImg = await signedUrl( params );

                  return {
                    vmtype,
                    vmImg: signedImg,
                  };
                } );
              } ),
          );

          return {
            vms: vmTaskData,
            fixtureImg: fixtureImage,
            ...fixtureDoc,
          };
        } ),
    );
    return res.sendSuccess( fixtureVmData );
  } catch ( e ) {
    logger.error( { functionName: 'getVmTaskData', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}


export async function updateVmData( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    if ( !req.files.file ) {
      return res.sendError( 'Excel file is required', 400 );
    }

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Basha';
    const raw = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    let initId = 81;

    for ( let i = 0; i < raw.length; i++ ) {
      const vmData = raw[i];

      const vmInsertData = {
        'clientId': '11',
        'type': 'vm',
        'productId': 'VM' + initId,
        'productName': vmData?.['VM Categories '],
        'productHeight': {
          'value': vmData?.['VM Height mm'],
          'unit': 'mm',
        },
        'productWidth': {
          'value': vmData?.['VM Width mm'],
          'unit': 'mm',
        },
        'startYPosition': vmData?.['StartPosition '],
        'endYPosition': vmData?.['End Position'],
        'xZone': vmData?.['Start Zone '],
      };

      const createdVm = await planoProductService.create( vmInsertData );

      initId += 1;

      const fixture = await storeFixtureService.findOne( { storeName: vmData?.['Store name '], fixtureNumber: vmData?.['Fixture Number'] } );

      const fixtureDoc = fixture?.toObject();

      if ( !fixture ) {
        continue;
      }

      const mappingData = {
        'clientId': '11',
        'storeName': fixtureDoc.storeName,
        'storeId': fixtureDoc.storeId,
        'type': 'vm',
        'planoId': fixtureDoc.planoId,
        'floorId': fixtureDoc.floorId,
        'fixtureId': fixtureDoc._id,
        'productId': createdVm.toObject()._id,
      };

      await planoMappingService.create( mappingData );
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'getVmTaskData', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

// import https from 'https';
// async function scrapeCrest() {
//   const storeIds = [ 'LKST494' ];
//   const apiUrl = 'https://api.getcrest.ai/api/ms_shelfsensei/layout/';
//   const bearerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ5NzkxNzUzLCJpYXQiOjE3NDk3ODgxNTMsImp0aSI6IjhmNDY4MTY0NTY5NTQ0YTU4OWJjMDU2NmU0ZGE0ZjI3IiwidXNlcl9pZCI6MTA4NSwiaWQiOjEwODUsImlzX21lZXNlZWtfYWNjb3VudCI6ZmFsc2UsImN1c3RvbWVyX2dyb3VwIjozOTgsImxpY2VuY2Vfc2NvcGVzIjpbeyJyZXNvdXJjZV9zZXQiOiJwcF9zZXQiLCJzY29wZV9yb2xlIjoiY29udHJpYnV0b3IifSx7InJlc291cmNlX3NldCI6ImRwX3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9LHsicmVzb3VyY2Vfc2V0IjoiZGZfc2V0Iiwic2NvcGVfcm9sZSI6ImNvbnRyaWJ1dG9yIn0seyJyZXNvdXJjZV9zZXQiOiJkZWZhdWx0X3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9XX0.wHQ2RPML7Jr6yE0V0mNvIrtUT8mFrvp7sBBtH6bhlSc';
//   const filePath = 'response.json';
//   let allResults = [];

//     if ( fs.existsSync( filePath ) ) {
//       try {
//         const existingData = fs.readFileSync( filePath, 'utf8' );
//         allResults = JSON.parse( existingData );
//         if ( !Array.isArray( allResults ) ) {
//           allResults = [];
//         }
//       } catch ( error ) {
//         console.error( 'Error reading existing JSON file:', error.message );
//         allResults = [];
//       }
//     }

//     for ( const storeId of storeIds ) {
//       try {
//         const result = await new Promise( ( resolve ) => {
//           const payload = JSON.stringify( { store_id: storeId } );
//           const options = {
//             method: 'POST',
//             headers: {
//               'Authorization': `Bearer ${bearerToken}`,
//               'Content-Type': 'application/json',
//               'Content-Length': Buffer.byteLength( payload ),
//             },
//           };

//           const req = https.request( apiUrl, options, ( res ) => {
//             let data = '';
//             res.on( 'data', ( chunk ) => {
//               data += chunk;
//             } );
//             res.on( 'end', () => {
//               try {
//                 const jsonData = JSON.parse( data );
//                 const result = { storeName: storeId, data: jsonData };
//                 allResults.push( result );
//                 fs.writeFileSync( filePath, JSON.stringify( allResults, null, 2 ) );
//                 console.log( 'Received Data:', result );
//                 resolve( result );
//               } catch ( error ) {
//                 console.error( `Error parsing JSON for ${storeId}:`, error.message );
//                 resolve( { storeName: storeId, data: null } );
//               }
//             } );
//           } );

//           req.on( 'error', ( error ) => {
//             console.error( `Error fetching data for ${storeId}:`, error.message );
//             resolve( { storeName: storeId, data: null } );
//           } );

//         req.write( payload );
//         req.end();
//       } );
//     } catch ( error ) {
//       console.error( `Unexpected error for ${storeId}:`, error.message );
//     }
//     await new Promise( ( resolve ) => setTimeout( resolve, 1000 ) );
//   }
// }

// scrapeCrest();

export async function createCrestPlanogram( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    if ( !req.files || !req.files.file ) {
      return res.sendError( 'JSON file is required', 400 );
    }

    const data = JSON.parse( req.files.file.data.toString( 'utf8' ) );

    const crestData = data.filter( ( item ) => item.data.message === 'SUCCESS' );

    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    for ( let i = 0; i < crestData.length; i++ ) {
      const storeData = crestData[i];

      const storeDetails = await storeService.findOne( { storeName: storeData.storeName } );

      const planoInsertData = {
        storeName: storeData.storeName,
        storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
        layoutName: `${storeData.storeName} - Layout`,
        clientId: '11',
        attachments: [],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        floorNumber: 1,
        productResolutionLevel: 'L2',
        scanType: 'qr',
      };

      const insertedPlano = await planoService.upsertOne( { storeName: storeData.storeName }, planoInsertData );

      const planoDoc = insertedPlano.toObject();

      const leftWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'LEFT WALL' );
      const leftFixtures = leftWall.flatMap( ( wall ) => wall.fixtures );
      const rightWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT WALL' );
      const rightFixtures = rightWall.flatMap( ( wall ) => wall.fixtures );
      const backWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT VERTICAL WALL' );
      const backFixtures = backWall.flatMap( ( wall ) => wall.fixtures );
      const floorFixtures = storeData.data.result.filter( ( entry ) => entry['main'] === 'Euro Center' || entry['main'] === 'Euro Center Dr' );

      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length/2;
      const totalRows = 2;

      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( 2 * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( 2 * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

      const finalXDistance = roundToTwo( ( maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance ) );
      const finalXDetailedDistance = roundToTwo( ( maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance ) );

      const finalYDistance = roundToTwo( ( maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) ) ) );
      const finalYDetailedDistance = roundToTwo( ( maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) ) ) );

      const floorInsertData = {
        storeName: planoDoc.storeName,
        storeId: planoDoc.storeId,
        layoutName: `${planoDoc.storeName} - Layout`,
        clientId: '11',
        floorNumber: 1,
        floorName: 'floor 1',
        layoutPolygon: [
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalYDistance,
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: finalYDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
          {
            elementType: 'entrance',
            distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
        ],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        planoId: planoDoc._id,
      };

      const layoutDoc = await storeBuilderService.upsertOne( { planoId: planoDoc._id }, floorInsertData );

      let fixtureCounter = 1;

      for ( let index = 0; index < leftFixtures.length; index++ ) {
        const fixture = leftFixtures[index];
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) continue;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 1,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter,
            },
            fixtureData );

        fixtureCounter +=1;

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;


        for ( let j = 0; j < fixtureConfigDoc.shelfConfig.length; j++ ) {
          const configShelf = fixtureConfigDoc.shelfConfig[j];
          const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );

          const shelfSection = shelfZone.products.find( ( product ) => product.isMerchandisingElement === false );

          const shelfData = {
            'clientId': '11',
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureId': createdFixture._id,
            'shelfNumber': j + 1,
            'shelfOrder': 'LTR',
            'shelfCapacity': configShelf.shelfCapacity,
            'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
            'sectionZone': configShelf.shelfZone,
            'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
          };

          await fixtureShelfService.upsertOne(
              {
                fixtureId: createdFixture._id,
                shelfNumber: j + 1,
              },
              shelfData,
          );
        }

        for ( let i = 0; i < fixture.productZones?.length; i++ ) {
          const vms = fixture.productZones[i].products.filter( ( vm ) => vm.isMerchandisingElement );
          const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === fixture.productZones[i].zoneName );
          const pids = fixture.productZones[i].products.filter( ( vm ) => !vm.isMerchandisingElement );


          for ( const vm of vms ) {
            let configData = vmConfig[0];

            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
            }

            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' && pids.length ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
            }

            if ( !configData ) continue;
            const insertData = {
              'clientId': '11',
              'productId': 'VMCR',
              'type': 'vm',
              'productName': vm.productName,
              'productHeight': {
                'value': configData.vmHeightmm,
                'unit': 'mm',
              },
              'productWidth': {
                'value': configData.vmWidthmm,
                'unit': 'mm',
              },
              'startYPosition': configData.startShelf,
              'endYPosition': configData.endShelf,
              'xZone': configData.zone,
              'fixtureConfigId': fixtureConfig._id,
            };

            const vmTemplate = await planoProductService.upsertOne(
                { 'productName': vm.productName, 'fixtureConfigId': fixtureConfig._id, 'productHeight.value': configData.vmHeightmm,
                  'productWidth.value': configData.vmWidthmm, 'startYPosition': configData.startShelf, 'endYPosition': configData.endShelf, 'xZone': configData.zone },
                insertData );


            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  productId: vmTemplate._id,
                },
                vmData,
            );
          }
        }
      }

      for ( let index = 0; index < backFixtures.length; index++ ) {
        const fixture = backFixtures[index];
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) continue;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 2,
          'relativePosition': {
            'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter,
            },
            fixtureData );

        fixtureCounter +=1;

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

        for ( let j = 0; j < fixtureConfigDoc.shelfConfig.length; j++ ) {
          const configShelf = fixtureConfigDoc.shelfConfig[j];
          const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );

          const shelfSection = shelfZone.products.find( ( product ) => product.isMerchandisingElement === false );

          const shelfData = {
            'clientId': '11',
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureId': createdFixture._id,
            'shelfNumber': j + 1,
            'shelfOrder': 'LTR',
            'shelfCapacity': configShelf.shelfCapacity,
            'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
            'sectionZone': configShelf.shelfZone,
            'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
          };

          await fixtureShelfService.upsertOne(
              {
                fixtureId: createdFixture._id,
                shelfNumber: j + 1,
              },
              shelfData,
          );
        }

        for ( let i = 0; i < fixture.productZones?.length; i++ ) {
          const vms = fixture.productZones[i].products.filter( ( vm ) => vm.isMerchandisingElement );
          const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === fixture.productZones[i].zoneName );
          const pids = fixture.productZones[i].products.filter( ( vm ) => !vm.isMerchandisingElement );

          for ( const vm of vms ) {
            let configData = vmConfig[0];

            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
            }

            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' && pids.length ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
            }


            if ( !configData ) continue;
            const insertData = {
              'clientId': '11',
              'productId': 'VMCR',
              'type': 'vm',
              'productName': vm.productName,
              'productHeight': {
                'value': configData.vmHeightmm,
                'unit': 'mm',
              },
              'productWidth': {
                'value': configData.vmWidthmm,
                'unit': 'mm',
              },
              'startYPosition': configData.startShelf,
              'endYPosition': configData.endShelf,
              'xZone': configData.zone,
              'fixtureConfigId': fixtureConfig._id,
            };

            const vmTemplate = await planoProductService.upsertOne(
                { 'productName': vm.productName, 'fixtureConfigId': fixtureConfig._id, 'productHeight.value': configData.vmHeightmm,
                  'productWidth.value': configData.vmWidthmm, 'startYPosition': configData.startShelf, 'endYPosition': configData.endShelf, 'xZone': configData.zone },
                insertData );


            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  productId: vmTemplate._id,
                },
                vmData,
            );
          }
        }
      }

      for ( let index = 0; index < rightFixtures.length; index++ ) {
        const fixture = rightFixtures[index];
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) continue;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 3,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter,
            },
            fixtureData );

        fixtureCounter +=1;

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

        for ( let j = 0; j < fixtureConfigDoc.shelfConfig.length; j++ ) {
          const configShelf = fixtureConfigDoc.shelfConfig[j];

          const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
          const shelfSection = shelfZone.products.find( ( product ) => product.isMerchandisingElement === false );

          const shelfData = {
            'clientId': '11',
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureId': createdFixture._id,
            'shelfNumber': j + 1,
            'shelfOrder': 'LTR',
            'shelfCapacity': configShelf.shelfCapacity,
            'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
            'sectionZone': configShelf.shelfZone,
            'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
          };

          await fixtureShelfService.upsertOne(
              {
                fixtureId: createdFixture._id,
                shelfNumber: j + 1,
              },
              shelfData,
          );
        }

        for ( let i = 0; i < fixture.productZones?.length; i++ ) {
          const vms = fixture.productZones[i].products.filter( ( vm ) => vm.isMerchandisingElement );
          const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === fixture.productZones[i].zoneName );
          const pids = fixture.productZones[i].products.filter( ( vm ) => !vm.isMerchandisingElement );


          for ( const vm of vms ) {
            let configData = vmConfig[0];


            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
            }

            if ( vm.productName === 'Creatr' && fixture.productZones[i].zoneName === 'Mid' && pids.length ) {
              configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
            }


            if ( !configData ) continue;

            const insertData = {
              'clientId': '11',
              'productId': 'VMCR',
              'type': 'vm',
              'productName': vm.productName,
              'productHeight': {
                'value': configData.vmHeightmm,
                'unit': 'mm',
              },
              'productWidth': {
                'value': configData.vmWidthmm,
                'unit': 'mm',
              },
              'startYPosition': configData.startShelf,
              'endYPosition': configData.endShelf,
              'xZone': configData.zone,
              'fixtureConfigId': fixtureConfig._id,
            };

            const vmTemplate = await planoProductService.upsertOne(
                { 'productName': vm.productName, 'fixtureConfigId': fixtureConfig._id, 'productHeight.value': configData.vmHeightmm,
                  'productWidth.value': configData.vmWidthmm, 'startYPosition': configData.startShelf, 'endYPosition': configData.endShelf, 'xZone': configData.zone },
                insertData );


            const vmData = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': layoutDoc.storeId,
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate._id,
            };

            await planoMappingService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  productId: vmTemplate._id,
                },
                vmData,
            );
          }
        }
      }

      for ( let index = 0; index < floorFixtures.length; index++ ) {
        const fixture = floorFixtures[index];
        const centerRow = Math.floor( totalRows / 2 );

        const startingX =roundToTwo( ( ( finalXDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) ) );
        const detailedStartingX = roundToTwo( ( ( finalXDetailedDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ) );

        const startingY = ( finalYDistance / 2 ) - ( centerRow * ( constantFixtureWidth / mmToFeet ) );
        const detailedStartingY = ( finalYDetailedDistance / 2 ) - ( centerRow * ( constantDetailedFixtureWidth / mmToFeet ) );

        const colIndex = Math.floor( index / 2 );
        const rowIndex = index % 2 === 0 ? 1 : 0;


        const xPos = roundToTwo( ( startingX + colIndex * ( constantFixtureLength / mmToFeet ) ) );
        const yPos = roundToTwo( ( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) ) );

        const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
        const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.main } );
        if ( !fixtureConfig ) continue;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.main}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
          'fixtureBrandSubCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'floor',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': xPos,
            'y': yPos,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': detailedXPos,
            'y': detailedYPos,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter,
            },
            fixtureData );

        fixtureCounter +=1;

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

        for ( let j = 0; j < fixtureConfigDoc.shelfConfig.length; j++ ) {
          const configShelf = fixtureConfigDoc.shelfConfig[j];

          const shelfSection = fixture.centerSuperSubMain.find( ( product ) => product.isVisualMerchandiser === false || product.isVisualMerchandiser === true );

          const shelfData = {
            'clientId': '11',
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureId': createdFixture._id,
            'shelfNumber': j + 1,
            'shelfOrder': 'LTR',
            'shelfCapacity': configShelf.shelfCapacity,
            'sectionName': fixture.centerSuperSubMain.find( ( product ) => product.isVisualMerchandiser === true ) ? shelfSection?.name + ' PIDs' : shelfSection?.name,
            'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
          };

          await fixtureShelfService.upsertOne(
              {
                fixtureId: createdFixture._id,
                shelfNumber: j + 1,
              },
              shelfData,
          );
        }


        const vm = fixture.centerSuperSubMain.find( ( vm ) => vm.isVisualMerchandiser );
        const vmConfig = fixtureConfigDoc.vmConfig;

        if ( vm ) {
          const configData1 = vmConfig[0];


          const insertData1 = {
            'clientId': '11',
            'productId': 'VMCR',
            'type': 'vm',
            'productName': vm.name,
            'productHeight': {
              'value': configData1.vmHeightmm,
              'unit': 'mm',
            },
            'productWidth': {
              'value': configData1.vmWidthmm,
              'unit': 'mm',
            },
            'startYPosition': configData1.startShelf,
            'endYPosition': configData1.endShelf,
            'xZone': configData1.zone,
            'fixtureConfigId': fixtureConfig._id,
          };

          const vmTemplate1 = await planoProductService.upsertOne(
              { 'productName': vm.name, 'fixtureConfigId': fixtureConfig._id, 'productHeight.value': configData1.vmHeightmm,
                'productWidth.value': configData1.vmWidthmm, 'startYPosition': configData1.startShelf, 'endYPosition': configData1.endShelf, 'xZone': configData1.zone },
              insertData1 );


          const vmData1 = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'type': 'vm',
            'fixtureId': createdFixture._id,
            'productId': vmTemplate1._id,
          };

          await planoMappingService.upsertOne(
              {
                fixtureId: createdFixture._id,
                productId: vmTemplate1._id,
              },
              vmData1,
          );

          const configData2 = vmConfig[1];

          const insertData2 = {
            'clientId': '11',
            'productId': 'VMCR',
            'type': 'vm',
            'productName': ' ',
            'productHeight': {
              'value': configData2.vmHeightmm,
              'unit': 'mm',
            },
            'productWidth': {
              'value': configData2.vmWidthmm,
              'unit': 'mm',
            },
            'startYPosition': configData2.startShelf,
            'endYPosition': configData2.endShelf,
            'xZone': configData2.zone,
            'fixtureConfigId': fixtureConfig._id,
          };


          const vmTemplate2 = await planoProductService.upsertOne(
              { 'productName': ' ', 'fixtureConfigId': fixtureConfig._id, 'productHeight.value': configData2.vmHeightmm,
                'productWidth.value': configData2.vmWidthmm, 'startYPosition': configData2.startShelf, 'endYPosition': configData2.endShelf, 'xZone': configData2.zone },
              insertData2 );


          const vmData2 = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'type': 'vm',
            'fixtureId': createdFixture._id,
            'productId': vmTemplate2._id,
          };

          await planoMappingService.upsertOne(
              {
                fixtureId: createdFixture._id,
                productId: vmTemplate2._id,
              },
              vmData2,
          );
        }
      }

      console.log( storeData.storeName );
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'createCrestPlanogram', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function updateCrestVms( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    if ( !req.files || !req.files.file ) {
      return res.sendError( 'JSON file is required', 400 );
    }

    const data = JSON.parse( req.files.file.data.toString( 'utf8' ) );

    const crestData = data.filter( ( item ) => item.data.message === 'FAILURE' );


    const returnSet = new Set();


    crestData.forEach( ( store ) => {
      returnSet.add( store.storeName );
      // store.data.result.forEach( ( wall ) => {
      //   wall.fixtures?.forEach( ( fixture ) => {
      //     fixture.productZones.forEach( ( zone ) => {
      //       zone.products.forEach( ( product ) => {

      //       } );
      //     } );
      //   } );
      // } );
    } );

    return res.sendSuccess( Array.from( returnSet ) );
  } catch ( e ) {
    logger.error( { functionName: 'createCrestPlanogram', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}


// async function filterStores() {
//   const stores = [
//     'ST338', 'LKST1304', 'ST303', 'LKST1228', 'LKST499', 'LKST479', 'ST320',
//     'LKST515', 'LKST406', 'ST392', 'ST328', 'ST332', 'LKST487', 'ST312',
//     'LKST615', 'LKST352', 'LKST457', 'LKST439', 'LKST347', 'LKST1084',
//     'LKST380', 'ST298', 'LKST356', 'LKST223', 'LKST480', 'ST30', 'ST285',
//     'LKST500', 'LKST466', 'LKST321', 'LKST678', 'LKST383', 'LKST365',
//     'LKST374', 'ST302', 'LKST420', 'LKST394', 'LKST444', 'LKST314',
//     'LKST01', 'LKST357', 'LKST465', 'LKST331', 'LKST440', 'LKST345',
//     'LKST389', 'ST330', 'LKST299', 'ST244', 'LKST294', 'ST314', 'LKST361',
//     'LKST377', 'LKST390', 'ST335', 'LKST416', 'ST293', 'LKST341', 'LKST501',
//     'LKST408', 'LKST227', 'LKST353', 'LKST364', 'ST318', 'LKST326',
//     'LKST344', 'ST321', 'LKST384', 'LKST496', 'LKST427', 'LKST325',
//     'LKST282', 'ST197', 'LKST388', 'LKST338', 'LKST371', 'ST326', 'LKST428',
//     'LKST112', 'LKST334', 'ST319', 'LKST464', 'LKST490', 'LKST11',
//     'LKST502', 'LKST1438',
//   ];

//   const rawData = fs.readFileSync( 'crest_scrap_v1.json', 'utf8' );
//   const allStores = JSON.parse( rawData );

//   const filteredStores = allStores.filter( ( store ) => stores.includes( store.storeName ) );

//   fs.writeFileSync( 'crest_filtered.json', JSON.stringify( filteredStores, null, 2 ) );
// }

// import fsp from 'fs/promises';

import sharp from 'sharp';


// const stitchImagesFromZips = async () => {
//   const zip1Path = 'crest_plano.zip';
//   const zip2Path = 'tango_plano.zip';
//   const outputDir = 'stitched';

//   const loadZip = async ( zipPath ) => {
//     const buffer = await fsp.readFile( zipPath );
//     return await JSZip.loadAsync( buffer );
//   };

//   const extractImages = async ( zip ) => {
//     const imageFiles = {};
//     const imageRegex = /\.(png|jpe?g)$/i;

//     for ( const [ name, file ] of Object.entries( zip.files ) ) {
//       const base = path.basename( name );
//       if ( !file.dir && imageRegex.test( base ) ) {
//         imageFiles[base] = await file.async( 'nodebuffer' );
//       }
//     }

//     return imageFiles;
//   };

//   const stitchOrCenter = async ( buffer1, buffer2, outputPath ) => {
//     const totalWidth = 7000;
//     const width1 = Math.round( totalWidth * 0.3 );
//     const width2 = Math.round( totalWidth * 0.7 );

//     let img1 = buffer1 ? await sharp( buffer1 ).resize( { width: width1 } ).toBuffer() : null;
//     let img2 = buffer2 ? await sharp( buffer2 ).resize( { width: width2 } ).toBuffer() : null;

//     const [ meta1, meta2 ] = await Promise.all( [
//       img1 ? sharp( img1 ).metadata() : Promise.resolve( { height: 0 } ),
//       img2 ? sharp( img2 ).metadata() : Promise.resolve( { height: 0 } ),
//     ] );

//     const maxHeight = Math.max( meta1.height, meta2.height );

//     const composites = [];
//     if ( img1 ) composites.push( { input: img1, top: 0, left: 0 } );
//     if ( img2 ) composites.push( { input: img2, top: 0, left: width1 } );

//     await sharp( {
//       create: {
//         width: totalWidth,
//         height: maxHeight,
//         channels: 4,
//         background: { r: 255, g: 255, b: 255, alpha: 0 },
//       },
//     } )
//         .composite( composites )
//         .png()
//         .toFile( outputPath );
//   };

//   try {
//     await fsp.mkdir( outputDir, { recursive: true } );

//     const [ zip1, zip2 ] = await Promise.all( [ loadZip( zip1Path ), loadZip( zip2Path ) ] );
//     const [ images1, images2 ] = await Promise.all( [ extractImages( zip1 ), extractImages( zip2 ) ] );

//     const allFilenames = new Set( [ ...Object.keys( images1 ), ...Object.keys( images2 ) ] );

//     for ( const name of allFilenames ) {
//       const buffer1 = images1[name] || null;
//       const buffer2 = images2[name] || null;
//       const outputPath = path.join( outputDir, `${name.replace( /\.[^/.]+$/, '' )}.png` );

//       try {
//         await stitchOrCenter( buffer1, buffer2, outputPath );
//         console.log( ` Processed: ${name}` );
//       } catch ( err ) {
//         console.error( ` Error processing ${name}:`, err.message );
//       }
//     }
//   } catch ( err ) {
//     console.error( ' Unexpected error:', err.message );
//   }
// };

// stitchImagesFromZips();


import { Builder } from 'selenium-webdriver';
// import chrome from 'selenium-webdriver/chrome.js';
import fetch from 'node-fetch';

import fetchCookie from 'fetch-cookie';


// async function downloadCrestImages() {
//   const storeList = await planoService.find( {} );
//   // const storeIds = storeList.map( ( store ) => store.toObject().storeName );
//   const storeIds = [ 'LKST1304' ];


//   const invalidateUrl = 'https://app.getcrest.ai/api/ms_iam/user/session/override/';
//   const tokenUrl = 'https://app.getcrest.ai/api/ms_iam/token/';

// let authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3NTEwNDAxLCJpYXQiOjE3NDc1MDY4MDEsImp0aSI6IjQ0YzNjOWNkZjUzYjQ5ZWE5OGQ3NWQxOTI1NGMxMGRkIiwidXNlcl9pZCI6MTA4NSwiaWQiOjEwODUsImlzX21lZXNlZWtfYWNjb3VudCI6ZmFsc2UsImN1c3RvbWVyX2dyb3VwIjozOTgsImxpY2VuY2Vfc2NvcGVzIjpbeyJyZXNvdXJjZV9zZXQiOiJwcF9zZXQiLCJzY29wZV9yb2xlIjoiY29udHJpYnV0b3IifSx7InJlc291cmNlX3NldCI6ImRwX3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9LHsicmVzb3VyY2Vfc2V0IjoiZGZfc2V0Iiwic2NvcGVfcm9sZSI6ImNvbnRyaWJ1dG9yIn0seyJyZXNvdXJjZV9zZXQiOiJkZWZhdWx0X3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9XX0.5OYkUq4kIWDUXothNCCfk6GIQHlhiMdOuHzuczWt6QM';

//   const fetchWithCookies = fetchCookie( fetch );

//   async function fetchNewToken() {
//     const invalidate = await fetchWithCookies( invalidateUrl, {
//       'method': 'POST',
//       'headers': { 'Content-Type': 'application/json' },
//       'body': JSON.stringify( { 'email': 'tango.lenskart@getcrest.ai', 'password': 'Tangolenskart@123' } ),
//     } );

//     const invalidateData = await invalidate.json();

//     console.log( invalidateData );

//     console.log( 'Fetching new token...' );
//     const res = await fetchWithCookies( tokenUrl, {
//       'method': 'POST',
//       'Accept': 'application/json, text/javascript, */*; q=0.01',
//       'headers': { 'Content-Type': 'application/json' },
//       'body': JSON.stringify( { 'email': 'tango.lenskart@getcrest.ai', 'password': 'Tangolenskart@123' } ),
//     } );

//     if ( !res.ok ) {
//       throw new Error( `Failed to fetch token: ${res.status}` );
//     }

//     const data = await res.json();
//     console.log( data );
//     authToken = data.access;
//     return authToken;
//   }

//   async function runAutomation( token, storeId, retries = 3 ) {
//     let attempts = 0;

// while ( attempts < retries ) {
//   const options = new chrome.Options();
//   // options.addArguments( 'headless' );
//   options.addArguments( 'disable-gpu' );

//       const driver = await new Builder()
//           .forBrowser( 'chrome' )
//           .setChromeOptions( options )
//           .build();

//       try {
//         const url = `https://app.getcrest.ai/pvt/?auth=${token}&module=planno&store_id=${storeId}`;
//         await driver.get( url );
//         const currentUrl = await driver.getCurrentUrl();
//         if ( currentUrl.includes( '/login' ) ) {
//           console.warn( `Redirected to login for store ${storeId}. Retrying with new token...` );
//           await driver.quit();
//           const newToken = await fetchNewToken();
//           return await runAutomation( newToken, storeId, retries );
//         }

//         const button = await driver.wait( until.elementLocated(
//             By.xpath( '//*[contains(@class, "MuiButtonBase-root") and contains(@class, "MuiButton-root") and contains(@class, "MuiButton-text") and contains(@class, "MuiButton-disableElevation") and contains(@class, "jss35") and contains(@class, "jss47") and contains(@class, "jss37") and contains(@class, "jss144")]' ),
//         ), 10000 );
//         await button.click();

//         const checkbox = await driver.wait(
//             until.elementLocated(
//                 By.xpath( '//*[contains(@class, "MuiCheckbox-root") and contains(@class, "MuiIconButton-root")]//input[@type="checkbox"]' ),
//             ),
//             10000,
//         );
//         await checkbox.click();

//         const downloadIcon = await driver.wait(
//             until.elementLocated(
//                 By.xpath( '//button[contains(@class, "cool-tooltip")]' ),
//             ),
//             10000,
//         );
//         await downloadIcon.click();


//         console.log( `Download triggered for store: ${storeId}` );
//         await driver.sleep( 5000 );
//         return;
//       } catch ( err ) {
//         attempts++;
//         console.error( `Error for store ${storeId}, attempt ${attempts}: ${err.message}` );
//         if ( attempts >= retries ) {
//           console.error( `Failed for store ${storeId} after ${retries} attempts` );
//         } else {
//           console.log( `Retrying for store ${storeId}, attempt ${attempts + 1}` );
//         }
//       } finally {
//         try {
//           if ( driver && ( await driver.getSession() ) ) {
//             await driver.quit();
//           }
//         } catch ( e ) {

//         }
//       }
//     }
//   }

//   for ( const storeId of storeIds ) {
//     try {
//       console.log( `Starting automation for store: ${storeId}` );
//       await runAutomation( authToken, storeId );
//     } catch ( error ) {
//       console.error( `Automation failed for store ${storeId}: ${error.message}` );
//     }
//   }
// }

// downloadCrestImages();
export async function updatePlanoFixtureLayout( planoId, floorId ) {
  try {
    console.log( 'dfghj' );
    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    const insertedPlano = await planoService.findOne( { _id: planoId } );
    if ( insertedPlano ) {
      const planoDoc = insertedPlano.toObject();

      const fixtureData = await storeFixtureService.findAndSort( { planoId: planoId, floorId: floorId }, {}, { fixtureNumber: 1 } );

      const leftFixtures = fixtureData.filter( ( fixture ) => fixture.associatedElementType == 'wall' && fixture.associatedElementNumber == 1 );
      const rightFixtures = fixtureData.filter( ( fixture ) => fixture.associatedElementType == 'wall' && fixture.associatedElementNumber == 3 );
      const backFixtures = fixtureData.filter( ( fixture ) => fixture.associatedElementType == 'wall' && fixture.associatedElementNumber == 2 );
      const floorFixtures = fixtureData.filter( ( fixture ) => fixture.fixtureType == 'floor' );

      // console.log( leftFixtures, 'left' );
      // console.log( rightFixtures, 'rightFixtures' );
      // console.log( backFixtures, 'backFixtures' );
      // console.log( floorFixtures, 'floorFixtures' );

      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length/2;
      const totalRows = 2;

      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( 2 * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( 2 * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

      const finalXDistance = roundToTwo( ( maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance ) );
      const finalXDetailedDistance = roundToTwo( ( maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance ) );

      const finalYDistance = roundToTwo( ( maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) ) ) );
      const finalYDetailedDistance = roundToTwo( ( maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) ) ) );

      const floorInsertData = {
        storeName: planoDoc.storeName,
        storeId: planoDoc.storeId,
        layoutName: `${planoDoc.storeName} - Layout`,
        clientId: '11',
        floorNumber: 1,
        floorName: 'floor 1',
        layoutPolygon: [
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalYDistance,
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: finalYDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
          {
            elementType: 'entrance',
            distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
        ],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        planoId: planoDoc._id,
      };

      await storeBuilderService.upsertOne( { planoId: planoDoc._id }, floorInsertData );

      for ( let index = 0; index < leftFixtures.length; index++ ) {
        const fixture = leftFixtures[index];

        const fixtureData = {
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
        };

        await storeFixtureService.updateOne(
            {
              _id: fixture._id,
            },
            fixtureData );
      }

      for ( let index = 0; index < backFixtures.length; index++ ) {
        const fixture = backFixtures[index];

        const fixtureData = {
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
        };

        await storeFixtureService.updateOne(
            {
              _id: fixture._id,
            },
            fixtureData );
      }

      for ( let index = 0; index < rightFixtures.length; index++ ) {
        const fixture = rightFixtures[index];

        const fixtureData = {
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
        };

        await storeFixtureService.updateOne(
            {
              _id: fixture._id,
            },
            fixtureData );
      }

      for ( let index = 0; index < floorFixtures.length; index++ ) {
        const fixture = floorFixtures[index];
        const centerRow = Math.floor( totalRows / 2 );

        const startingX =roundToTwo( ( ( finalXDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) ) );
        const detailedStartingX = roundToTwo( ( ( finalXDetailedDistance / 2 ) - ( ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ) );

        const startingY = ( finalYDistance / 2 ) - ( centerRow * ( constantFixtureWidth / mmToFeet ) );
        const detailedStartingY = ( finalYDetailedDistance / 2 ) - ( centerRow * ( constantDetailedFixtureWidth / mmToFeet ) );

        const colIndex = Math.floor( index / 2 );
        const rowIndex = index % 2 === 0 ? 1 : 0;


        const xPos = roundToTwo( ( startingX + colIndex * ( constantFixtureLength / mmToFeet ) ) );
        const yPos = roundToTwo( ( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) ) );

        const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
        const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );


        const fixtureData = {
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': xPos,
            'y': yPos,
            'unit': 'ft',
          },
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': detailedXPos,
            'y': detailedYPos,
            'unit': 'ft',
          },
        };

        await storeFixtureService.updateOne(
            {
              _id: fixture._id,
            },
            fixtureData );
      }
    }
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'createCrestPlanogram', error: e } );
    return false;
  }
}

export async function updatelayout( req, res ) {
  try {
    let getLayoutTaskDetails = await planoTaskService.find( { date_string: { $gte: req.body.date }, status: 'incomplete', type: 'layout' } );
    if ( !getLayoutTaskDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }
    for ( let layout of getLayoutTaskDetails ) {
      let layoutAnswer = layout.answers[1];
      let planoDetails = await planoService.findOne( { _id: layout.planoId } );
      let fixtureDetails = await storeFixtureService.findAndSort( { planoId: layout.planoId, floorId: layout.floorId }, {}, { fixtureNumber: 1 } );
      if ( layoutAnswer?.extraFixture?.length ) {
        let deletedFixtureList = layoutAnswer.extraFixture.map( ( fixture ) => fixture.fixtureId );
        fixtureDetails = fixtureDetails.filter( ( fixture ) => !deletedFixtureList.includes( fixture._id.toString() ) );
        await storeFixtureService.deleteMany( { _id: { $in: deletedFixtureList } } );
        await fixtureShelfService.deleteMany( { fixtureId: { $in: deletedFixtureList } } );
        await planoMappingService.deleteMany( { fixtureId: { $in: deletedFixtureList } } );
      }
      if ( layoutAnswer?.wronglyLocatedFixtures?.length ) {
        layoutAnswer.wronglyLocatedFixtures.sort( ( a, b ) => a.position - b.position );
        let elementsGroup = layoutAnswer.wronglyLocatedFixtures.reduce( ( acc, ele ) => {
          ele.location = ele?.location == 'centre' ? 'floor' : ele.location;
          if ( !acc[ele?.location] ) {
            acc[ele.location] = [ ele ];
          } else {
            acc[ele.location].push( ele );
          }
          return acc;
        }, {} );
        Object.entries( elementsGroup ).forEach( async ( [ key, values ] ) => {
          let removeFixtures = layoutAnswer.wronglyLocatedFixtures.filter( ( rmFx ) => {
            if ( rmFx.fixtureElement == key && rmFx.location != key ) {
              return rmFx;
            }
          } ).map( ( fxtu ) => fxtu.fixtureId );
          let matchingFixtures = [];
          let maxFixtureNumber = 0;
          let elementType = '';
          let elementNumber = 0;
          if ( key != 'floor' ) {
            elementType = key.split( ' ' )[0];
            elementNumber = key.split( ' ' )[1];
            matchingFixtures = fixtureDetails.filter(
                ( elementFixture ) =>
                  elementFixture.associatedElementType == elementType &&
                  elementFixture.associatedElementNumber == elementNumber,
            );
          } else {
            matchingFixtures = fixtureDetails.filter(
                ( elementFixture ) =>
                  elementFixture.fixtureType == 'floor',
            );
          }
          if ( matchingFixtures.length ) {
            matchingFixtures.sort( ( a, b ) => a.associatedElementFixtureNumber - b.associatedElementFixtureNumber );
            matchingFixtures = matchingFixtures.filter( ( fxt ) => !removeFixtures.includes( fxt._id.toString() ) );
            maxFixtureNumber = Math.max(
                ...matchingFixtures.map( ( f ) => f.associatedElementFixtureNumber ),
            );
          }
          for ( let fixture of values ) {
            let fixtureIndex = fixtureDetails.findIndex( ( fix ) => fix._id.toString() == fixture.fixtureId.toString() );
            if ( fixtureIndex != -1 ) {
              let details = {
                ...fixtureDetails[fixtureIndex].toObject(),
                fixtureType: key != 'floor' ? 'wall' : 'floor',
                associatedElementType: elementType, associatedElementNumber: elementNumber,
                ...( key == 'floor' ) ? { header: '', footer: '' } : {},
              };
              fixtureDetails.splice( fixtureIndex, 1 );
              let matchFixtureIndex = matchingFixtures.findIndex( ( fix ) => fix._id.toString() == fixture.fixtureId.toString() );
              if ( matchFixtureIndex != -1 ) {
                matchingFixtures.splice( matchFixtureIndex, 1 );
              }
              if ( maxFixtureNumber < parseInt( fixture.position ) ) {
                details.associatedElementFixtureNumber = maxFixtureNumber + 1;
                matchingFixtures.splice( maxFixtureNumber, 0, details );
                maxFixtureNumber = maxFixtureNumber + 1;
              } else {
                details.associatedElementFixtureNumber = parseInt( fixture.position );
                matchingFixtures.splice( parseInt( fixture.position ) - 1, 0, details );
              }
            }
          }
          let fixIdList = matchingFixtures.map( ( mixFixture ) => mixFixture._id.toString() );
          fixtureDetails = fixtureDetails.filter( ( fixt ) => !fixIdList.includes( fixt._id.toString() ) );
          fixtureDetails.push( ...matchingFixtures );
        } );
      }
      if ( layoutAnswer?.correctedFixture?.length ) {
        for ( let [ fixtureIndex, fixture ] of layoutAnswer.correctedFixture.entries() ) {
          let matchingFixtures;
          let maxFixtureNumber = 0;
          if ( fixture.alignment != 'centre' ) {
            let elementType = fixture.alignment.split( ' ' )[0];
            let elementNumber = fixture.alignment.split( ' ' )[1];
            matchingFixtures = fixtureDetails.filter(
                ( elementFixture ) =>
                  elementFixture.associatedElementType == elementType &&
                elementFixture.associatedElementNumber == elementNumber,
            );
          } else {
            matchingFixtures = fixtureDetails.filter(
                ( elementFixture ) =>
                  elementFixture.fixtureType == 'floor',
            );
          }
          if ( matchingFixtures.length ) {
            maxFixtureNumber = Math.max(
                ...matchingFixtures.map( ( f ) => f.associatedElementFixtureNumber ),
            );
          }
          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( fixtureConfig ) {
            const fixtureConfigDoc = fixtureConfig.toObject();
            const constantFixtureLength = 1220;
            const constantFixtureWidth = 610;
            const fixtureData = {
              'clientId': planoDetails.clientId,
              'storeName': planoDetails.storeName,
              'storeId': planoDetails.storeId,
              'planoId': layout.planoId,
              'floorId': layout.floorId,
              'fixtureName': `Fixture ${fixtureDetails.length + 1} - ${fixture.fixtureType}`,
              'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
              'fixtureBrandCategory': fixture.fixtureCategory.length ? ( fixture.fixtureCategory.length > 1 ? fixture.fixtureCategory.join( ' + ' ) : fixture.fixtureCategory[0] ) : undefined,
              'fixtureBrandSubCategory': fixture.fixtureCategory.length ? ( fixture.fixtureCategory.length > 1 ? fixture.fixtureCategory.join( ' + ' ) : fixture.fixtureCategory[0] ) : undefined,
              'fixtureCode': fixtureConfigDoc?.fixtureCode,
              'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
              'fixtureType': fixture.alignment != 'centre' ? 'wall' : 'floor',
              'fixtureHeight': {
                'value': 0,
                'unit': 'mm',
              },
              'fixtureLength': {
                'value': constantFixtureLength,
                'unit': 'mm',
              },
              'fixtureWidth': {
                'value': constantFixtureWidth,
                'unit': 'mm',
              },
              ...( fixture.alignment != 'centre' ) ? { 'associatedElementType': fixture.alignment.split( ' ' )[0] } :{},
              ...( fixture.alignment != 'centre' ) ? { 'associatedElementNumber': fixture.alignment.split( ' ' )[1] } :{},
              'fixtureNumber': fixtureDetails.length + 1,
              'productResolutionLevel': 'L2',
              'associatedElementFixtureNumber': maxFixtureNumber + 1,
              ...( fixture.alignment != 'centre' ) ? { 'header': fixture.fixtureCategory.length ? ( fixture.fixtureCategory.length > 1 ? fixture.fixtureCategory.join( ' + ' ) : fixture.fixtureCategory[0] ) : undefined } : {},
              ...( fixture.alignment != 'centre' ) ? { 'footer': 'Storage Box' } : {},
              'fixtureConfigId': fixtureConfigDoc._id,
            };

            let fixtureDoc = await storeFixtureService.create( fixtureData );
            if ( fixtureDoc ) {
              let productCount = 0;
              matchingFixtures.splice( parseInt( fixture.position ) - 1, 0, JSON.parse( JSON.stringify( fixtureDoc ) ) );
              let fixIdList = matchingFixtures.map( ( mixFixture ) => mixFixture._id.toString() );
              fixtureDetails = fixtureDetails.filter( ( fixt ) => !fixIdList.includes( fixt._id.toString() ) );
              fixtureDetails.push( ...matchingFixtures );
              let shelfDetails = layoutAnswer.shlef[fixtureIndex];
              for ( let i=0; i<shelfDetails.count; i++ ) {
                const insertData = {
                  'clientId': planoDetails.clientId,
                  'storeName': planoDetails.storeName,
                  'storeId': planoDetails.storeId,
                  'planoId': planoDetails._id,
                  'floorId': layout.floorId,
                  'fixtureId': fixtureDoc._id,
                  'shelfNumber': i + 1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': shelfDetails.values.value[i],
                  'sectionName': shelfDetails.values.subCategory[i].length ? ( shelfDetails.values.subCategory[i].length > 1 ? shelfDetails.values.subCategory[i].join( ' + ' ) : shelfDetails.values.subCategory[i][0] ) : undefined,
                  'sectionZone': shelfDetails.values.section[i],
                };
                productCount = productCount + insertData.shelfCapacity;
                await fixtureShelfService.create( insertData );
              }
              await storeFixtureService.updateOne( { _id: fixtureDoc._id }, { fixtureCapacity: productCount } );
            }
          }
        }
      }
      let groupElements = fixtureDetails.reduce( ( acc, ele ) => {
        let elementDetails = ele?.associatedElementType ? ele?.associatedElementType +' '+ ele?.associatedElementNumber : 'floor';
        if ( !acc[elementDetails] ) {
          acc[elementDetails] = [ ele ];
        } else {
          acc[elementDetails].push( ele );
        }
        return acc;
      }, {} );
      let fixtureNumber = 0;
      for ( const [ key, values ] of Object.entries( groupElements ) ) {
        for ( let elementIndex = 0; elementIndex < values.length; elementIndex++ ) {
          const element = values[elementIndex];

          let name = element.fixtureName.split( ' ' );
          name[1] = elementIndex + 1;

          const data = {
            fixtureNumber: ++fixtureNumber,
            associatedElementFixtureNumber: elementIndex + 1,
            fixtureName: name.join( ' ' ),
            associatedElementType: element.associatedElementType,
            associatedElementNumber: element.associatedElementNumber,
            fixtureType: element.fixtureType,
            header: element.header,
            footer: element.footer,
          };

          await storeFixtureService.updateOne( { _id: element._id }, data );
          if ( key == 'floor' ) {
            await storeFixtureService.removeKeys( { _id: element._id }, { $unset: { header: '', footer: '', associatedElementType: '', associatedElementNumber: '' } } );
          }
        }
      }
      await updatePlanoFixtureLayout( layout.planoId, layout.floorId );
    }
    return res.sendSuccess( 'Layout updated sucessfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updatelayout', error: e } );
    return res.sendError( e, 500 );
  }
}


export async function downloadPlanoImage( req, res ) {
  try {
    let query = [
      {
        $match: {
          date_string: { $gte: req.body.fromDate, $lte: req.body.toDate },
          type: 'layout',
          status: 'incomplete',
          storeName: { $in: req.body.store },
        },
      },
      {
        $project: {
          storeName: 1,
          answers: 1,
          type: 1,
          status: 1,
          planoId: 1,
          floorId: 1,
        },
      },
    ];

    let taskDetails = await planoTaskService.aggregate( query );
    if ( !taskDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let planoList = [ ...new Set( taskDetails.map( ( ele ) => ele.planoId ) ) ];
    console.log( planoList );
    let storeList = [ ...new Set( taskDetails.map( ( ele ) => ele.storeName ) ) ];
    console.log( storeList );
    async function sleep( ms ) {
      return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
    }

    async function openPlanoUrls( planoList ) {
      for ( let id of planoList ) {
        const url = `https://plano-builder.tangoeye.ai/#/plano?planoId=${id}&token&download=1&url=http://localhost:3008`;
        const driver = await new Builder().forBrowser( 'chrome' ).build();
        try {
          await driver.get( url );
          await sleep( 20000 );
        } catch ( err ) {
          console.error( `Error while opening planoId ${id}:`, err );
        } finally {
          try {
            if ( driver && await driver.getSession() ) {
              await driver.quit();
            }
          } catch ( quitErr ) {
            console.warn( `Error while quitting driver for planoId ${id}:`, quitErr );
          }
        }
      }
    }
    if ( !req.body?.merge ) {
      const downloadsPath = path.join( os.homedir(), 'Downloads' );
      const targetFolder = path.join( __dirname, '..', '..', `${req.body.file}Images` );
      console.log( 'test' );
      await openPlanoUrls( planoList );
      if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder, { recursive: true } );
        console.log( 'Created folder:', targetFolder );
      }
      fs.readdir( downloadsPath, async ( err, files ) => {
        if ( err ) {
          return console.error( 'Failed to read Downloads folder:', err );
        }
        console.log( files );
        for ( let file of files ) {
          let fileName = file.split( '.' )[0];
          const sourcePath = path.join( downloadsPath, file );
          const targetPath = path.join( targetFolder, file );
          if ( storeList.includes( fileName ) ) {
            if ( fs.existsSync( sourcePath ) ) {
              // let chckFixtureCount = await storeFixtureService.findAndSort( { storeName: fileName }, { associatedElementFixtureNumber: 1 }, { associatedElementFixtureNumber: -1 } );
              // console.log( chckFixtureCount[0].associatedElementFixtureNumber );
              // if ( chckFixtureCount[0].associatedElementFixtureNumber < 10 ) {
              //   sharp( sourcePath )
              //       .extract( { left: 1200, top: 30, width: 3800, height: 3200 } )
              //       .toFile( targetPath )
              //       .then( () => {
              //         fs.unlinkSync( sourcePath );
              //         console.log( 'Image cropped successfully!' );
              //       } )
              //       .catch( ( err ) => {
              //         console.error( 'Error cropping image:', err );
              //       } );
              // } else {
              fs.copyFile( sourcePath, targetPath, ( err ) => {
                if ( err ) {
                  console.error( 'Error copying file:', err );
                } else {
                  fs.unlinkSync( sourcePath );
                  console.log( `File moved from Downloads to ${targetFolder}` );
                }
              } );
              // }
            } else {
              console.warn( 'File not found in Downloads:', fileName );
            }
          }
        }
      } );
      return res.sendSuccess( 'Image Generated SuccessFully' );
    }

    if ( req.body?.merge ) {
      const targetFolder = path.join( __dirname, '..', '..', `mergedImages` );
      if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder, { recursive: true } );
        console.log( 'Created folder:', targetFolder );
      }
      let spacing = 500;
      for ( let store of storeList ) {
        if ( store != undefined ) {
          const image1 = path.join( __dirname, '..', '..', `oldImages/${store}.png` );
          const image2 = path.join( __dirname, '..', '..', `newImages/${store}.png` );

          const output = path.join( targetFolder, `/${store}.png` );


          const [ img1, img2 ] = await Promise.all( [
            sharp( image1 ),
            sharp( image2 ),
          ] );

          const [ meta1, meta2 ] = await Promise.all( [ img1.metadata(), img2.metadata() ] );

          const canvasWidth = meta1.width + meta2.width + spacing;
          const canvasHeight = Math.max( meta1.height, meta2.height );

          const [ img1Buffer, img2Buffer ] = await Promise.all( [
            img1.toBuffer(),
            img2.toBuffer(),
          ] );

          await sharp( {
            create: {
              width: canvasWidth,
              height: canvasHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255 },
            },
          } )
              .composite( [
                { input: img1Buffer, top: 0, left: 0 },
                { input: img2Buffer, top: 0, left: meta1.width + spacing },
              ] )
              .toFile( output );

          console.log( 'Images merged successfully!' );
        }
      }
      let zip = new JSZip;
      const promises = storeList.map( async ( store ) => {
        try {
          const file = fs.readFileSync( `${targetFolder}/${store}.png` );
          zip.file( `${store}.png`, file );
        } catch ( err ) {
          console.error( `Error reading ${store}.png:`, err );
        }
      } );

      await Promise.all( promises );

      const zipBuffer = await zip.generateAsync( { type: 'nodebuffer' } );

      res.set( {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=download.zip',
      } );

      let rmFolderList = [ 'oldImages', 'newImages', 'mergedImages' ];
      for ( let folder of rmFolderList ) {
        const filePath = path.join( __dirname, '..', '..', folder );
        fs.rm( filePath, { recursive: true, force: true } );
      }

      return res.send( zipBuffer );
    }
  } catch ( e ) {
    console.log( e );
    return res.sendError( e, 500 );
  }
}


export async function updateCrestPlanogram( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    const startTime = Date.now();

    const layoutApiUrl = 'https://api.getcrest.ai/api/ms_shelfsensei/layout/';
    let staticToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ1NTE3MjQxLCJpYXQiOjE3NDU1MTM2NDEsImp0aSI6Ijg3MWVlNTA3ODY2OTQ5OTVhMTQ0YTk4NzQyNzY0MzEzIiwidXNlcl9pZCI6MTA4NSwiaWQiOjEwODUsImlzX21lZXNlZWtfYWNjb3VudCI6ZmFsc2UsImN1c3RvbWVyX2dyb3VwIjozOTgsImxpY2VuY2Vfc2NvcGVzIjpbeyJyZXNvdXJjZV9zZXQiOiJwcF9zZXQiLCJzY29wZV9yb2xlIjoiY29udHJpYnV0b3IifSx7InJlc291cmNlX3NldCI6ImRwX3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9LHsicmVzb3VyY2Vfc2V0IjoiZGZfc2V0Iiwic2NvcGVfcm9sZSI6ImNvbnRyaWJ1dG9yIn0seyJyZXNvdXJjZV9zZXQiOiJkZWZhdWx0X3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9XX0.eGzTMGwwstr13M0Hu1Ls5-gkE_oSPMJJBL2wgygT6Ac';
    const fetchWithCookies = fetchCookie( fetch );


    async function fetchStoreData( store, bearerToken, res ) {
      const payload = JSON.stringify( { store_id: store.toObject().storeName?.toUpperCase() } );

      try {
        const response = await fetch( layoutApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength( payload ),
          },
          body: payload,
        } );

        const data = await response.text();
        let jsonData = null;

        try {
          jsonData = JSON.parse( data );
        } catch ( parseError ) {
          logger.error( { functionName: `Warning: Received invalid JSON for store ${store.toObject().storeName}`, error: parseError } );
          console.warn( `Warning: Received invalid JSON for store ${store.toObject().storeName}` );
          return { storeName: store.toObject().storeName, data: null };
        }

        if ( jsonData.result === 'Token is invalid or expired' ) {
          console.log( 'Token expired, retrying...' );
          try {
            const newToken = await fetchNewToken();
            staticToken = newToken;
            return await fetchStoreData( store, newToken, res );
          } catch ( retryError ) {
            logger.error( { functionName: 'Failed to refresh token', error: retryError } );
            console.log( retryError );
            return res.sendError( 'Failed to refresh token', 401 );
          }
        }

        return { storeName: store.toObject().storeName, data: jsonData };
      } catch ( error ) {
        logger.error( { functionName: `Error fetching data for ${store.toObject().storeName}:`, error } );
        console.error( `Error fetching data for ${store.toObject().storeName}:`, error.message );
        return { storeName: store.toObject().storeName, data: null };
      }
    }


    const fetchNewToken = async () => {
      const email = 'tango.lenskart@getcrest.ai';
      const password = 'Tangolenskart@123';

      const credentials = JSON.stringify( { email, password } );

      const invalidateUrl = 'https://app.getcrest.ai/api/ms_iam/user/session/override/';
      const tokenUrl = 'https://app.getcrest.ai/api/ms_iam/token/';

      try {
        const invalidateRes = await fetchWithCookies( invalidateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: credentials,
        } );

        const invalidateData = await invalidateRes.json();
        console.log( 'Invalidate response:', invalidateData );

        console.log( 'Fetching new token...' );
        const tokenRes = await fetchWithCookies( tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
          },
          body: credentials,
        } );

        const tokenData = await tokenRes.json();
        console.log( 'Token response:', tokenData );

        return tokenData.access;
      } catch ( error ) {
        console.error( 'Error fetching new token:', error );
        throw error;
      }
    };

    const fetchVmImage = async ( attachmentId ) => {
      try {
        const response = await fetchWithCookies( `https://api.getcrest.ai/api/ms_data_preparation/master_data/attachment/?preview=0&attachment_id=${attachmentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${staticToken}`,
            'Cookie': 'prod_session_key=w144dqljxlh096487nc33rm09vwtossh',
          },
        } );

        if ( !response.ok ) {
          throw new Error( `Failed to fetch image: ${response.status}` );
        }

        // const dest = fs.createWriteStream( `${attachmentId}.png` );
        // response.body.pipe( dest );

        // return await response.buffer();

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from( arrayBuffer );
      } catch ( error ) {
        console.error( 'Error fetching image buffer:', error.message );
        throw error;
      }
    };

    const getImageMetadata = async ( imageBuffer ) => {
      try {
        const metadata = await sharp( imageBuffer ).metadata();
        const { width, height, format } = metadata;

        if ( !width || !height || !format ) throw new Error( 'Invalid image metadata' );

        const ratio = width / height;
        const normalizedRatio = ratio > 1 ? ratio : 1 / ratio;
        const squareThreshold = 1.2;
        const imageShape = normalizedRatio <= squareThreshold ? 'square' : 'rectangle';

        const fileExtension = format === 'jpeg' ? 'jpg' : format;
        const contentType = `image/${format}`;

        return {
          imageShape,
          width,
          height,
          fileExtension,
          contentType,
        };
      } catch ( error ) {
        console.error( 'Error processing image buffer:', error.message );
        throw error;
      }
    };


    if ( !req?.body?.storeName ) {
      return res.sendError( 'No store supplied', 200 );
    }

    let storeQuery = {
      clientId: '11',
      $and: [
        { storeName: req.body.storeName },
        // { storeName: { $nin: [ 'LKST98', 'LKST1193' ] } },
      ],
    };

    let storeList = await storeService.find( storeQuery );

    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    for ( let i = 0; i < storeList.length; i++ ) {
      const storeData = await fetchStoreData( storeList[i], staticToken, res );

      if ( storeData?.data?.message !== 'SUCCESS' ) continue;

      const storeDetails = storeList[i];

      const existingPlanogram = await planoService.findOne( { storeName: storeData.storeName } );

      if ( existingPlanogram ) {
        // const checkTaskSubmitted = await planoTaskService.findOne( { planoId: existingPlanogram.toObject()._id } );

        const checkTaskCreated = await processedTaskService.findOne( { storeName: storeData.storeName, date_string: dayjs().format( 'YYYY-MM-DD' ), isPlano: true } );

        if ( checkTaskCreated ) {
          continue;
        }
      }


      if ( existingPlanogram?.toObject()?._id && mongoose.Types.ObjectId.isValid( existingPlanogram?.toObject()?._id ) ) {
        await Promise.all( [ planoService.deleteOne( { _id: existingPlanogram?.toObject()?._id } ), storeBuilderService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
          storeFixtureService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ), fixtureShelfService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
          planoMappingService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
        ] );
      }


      const planoInsertData = {
        storeName: storeData.storeName,
        storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
        layoutName: `${storeData.storeName} - Layout`,
        clientId: '11',
        attachments: [],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        floorNumber: 1,
        productResolutionLevel: 'L2',
        scanType: 'qr',
      };

      const insertedPlano = await planoService.upsertOne( { storeName: storeData.storeName }, planoInsertData );
      const planoDoc = insertedPlano.toObject();

      const floors = new Set();

      for ( const item of storeData.data.result ) {
        if ( item.floor ) {
          floors.add( item.floor );
        }

        if ( Array.isArray( item.fixtures ) ) {
          for ( const fixture of item.fixtures ) {
            if ( fixture.floor ) {
              floors.add( fixture.floor );
            }
          }
        }
      }

      const floorArray = Array.from( floors );

      let isFloorKeyExist = true;

      if ( !floorArray.length ) {
        isFloorKeyExist = false;
        floorArray.push( 'GROUND' );
      }

      for ( let floorIndex = 0; floorIndex < floorArray.length; floorIndex++ ) {
        const leftWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'LEFT WALL' );
        let leftFixtures = leftWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          leftFixtures = leftFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        const rightWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT WALL' );
        let rightFixtures = rightWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          rightFixtures = rightFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        const backWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT VERTICAL WALL' );
        let backFixtures = backWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          backFixtures = backFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        let floorFixtures = storeData.data.result.filter(
            ( entry ) => entry['main'] === 'Euro Center' || entry['main'] === 'Euro Center Dr',
        );
        if ( isFloorKeyExist ) {
          floorFixtures = floorFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }

        const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
        const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

        const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

        const maxFixturesPerRow = floorFixtures.length/2;
        const totalRows = 2;

        const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

        const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( 2 * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
        const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( 2 * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

        const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

        const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
        const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

        const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
        const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

        const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
        const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

        const finalXDistance = roundToTwo( ( maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance ) );
        const finalXDetailedDistance = roundToTwo( ( maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance ) );

        const finalYDistance = roundToTwo( ( maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) ) ) );
        const finalYDetailedDistance = roundToTwo( ( maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) ) ) );


        const floorInsertData = {
          storeName: planoDoc.storeName,
          storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
          layoutName: `${planoDoc.storeName} - Layout`,
          clientId: '11',
          floorNumber: floorIndex + 1,
          floorName: `${floorArray[floorIndex].toLowerCase()} floor`,
          crestLayout: true,
          layoutPolygon: [
            {
              elementType: 'wall',
              distance: finalXDistance,
              unit: 'ft',
              direction: 'right',
              angle: 90,
              elementNumber: 1,
              detailedDistance: finalXDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: finalYDistance,
              unit: 'ft',
              direction: 'down',
              angle: 90,
              elementNumber: 2,
              detailedDistance: finalYDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: finalXDistance,
              unit: 'ft',
              direction: 'left',
              angle: 90,
              elementNumber: 3,
              detailedDistance: finalXDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 4,
              detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
            },
            {
              elementType: 'entrance',
              distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 1,
              detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
            },
            {
              elementType: 'wall',
              distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 5,
              detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
            },
          ],
          createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
          createdByName: 'Bejan',
          createdByEmail: 'bejan@tangotech.co.in',
          status: 'completed',
          planoId: planoDoc._id,
        };

        const layoutDoc = await storeBuilderService.upsertOne( { planoId: planoDoc._id, floorNumber: floorIndex + 1 }, floorInsertData );

        let fixtureCounter = 1;

        for ( let index = 0; index < leftFixtures.length; index++ ) {
          const fixture = leftFixtures[index];

          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          const fixtureData = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
            'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
            'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureCode': fixtureConfigDoc?.fixtureCode,
            'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
            'fixtureType': 'wall',
            'fixtureHeight': {
              'value': 0,
              'unit': 'mm',
            },
            'fixtureLength': {
              'value': constantFixtureLength,
              'unit': 'mm',
            },
            'fixtureWidth': {
              'value': constantFixtureWidth,
              'unit': 'mm',
            },
            'associatedElementType': 'wall',
            'associatedElementNumber': 1,
            'relativePosition': {
              'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
              'y': 0,
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            'detailedFixtureLength': {
              'value': constantDetailedFixtureLength,
              'unit': 'mm',
            },
            'detailedFixtureWidth': {
              'value': constantDetailedFixtureWidth,
              'unit': 'mm',
            },
            'relativeDetailedPosition': {
              'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
              'y': 0,
              'unit': 'ft',
            },
            'productResolutionLevel': 'L2',
            'associatedElementFixtureNumber': index+1,
            'header': fixture.header,
            'footer': fixture.footer,
            'fixtureConfigId': fixtureConfigDoc._id,
          };

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          await Promise.all(
              fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
                const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
                const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

                const shelfData = {
                  'clientId': '11',
                  'storeName': layoutDoc.storeName,
                  'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                  'planoId': layoutDoc.planoId,
                  'floorId': layoutDoc._id,
                  'fixtureId': createdFixture._id,
                  'shelfNumber': j + 1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': configShelf.shelfCapacity,
                  'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                  'sectionZone': configShelf.shelfZone,
                  'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
                };

                await fixtureShelfService.upsertOne(
                    {
                      fixtureId: createdFixture._id,
                      shelfNumber: j + 1,
                    },
                    shelfData,
                );
              } ),
          );

          await Promise.all(
              fixture.productZones?.map( async ( zone ) => {
                const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
                const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
                const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

                await Promise.all(
                    vms.map( async ( vm ) => {
                      let configData = vmConfig[0];

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                      }

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                      }

                      if ( !configData ) return;

                      let attachmentId = '';
                      let imgPath = '';
                      let imageMeta = null;


                      if ( zone.preview_image_url ) {
                        const parsedUrl = new URL( zone.preview_image_url );
                        attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

                        const isVmImageExist = await planoProductService.findOne( { crestImageId: attachmentId } );


                        if ( !isVmImageExist ) {
                          const vmImageData = await fetchVmImage( attachmentId );

                          imageMeta = await getImageMetadata( vmImageData );

                          const params = {
                            Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                            Key: `crestVms/`,
                            fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                            ContentType: imageMeta.contentType,
                            body: vmImageData,
                          };

                          const imgUpload = await fileUpload( params );

                          imgPath = imgUpload.Key;
                        }
                      }

                      const insertData = {
                        'clientId': '11',
                        'productId': 'VMCR',
                        'type': 'vm',
                        'productName': vm.productName,
                        'productHeight': {
                          'value': configData.vmHeightmm,
                          'unit': 'mm',
                        },
                        'productWidth': {
                          'value': configData.vmWidthmm,
                          'unit': 'mm',
                        },
                        'startYPosition': configData.startShelf,
                        'endYPosition': configData.endShelf,
                        'xZone': configData.zone,
                        'fixtureConfigId': fixtureConfig._id,
                      };

                      if ( attachmentId && imgPath ) {
                        insertData.crestImageId = attachmentId;
                        insertData.productImageUrl = imgPath;

                        const shelfData = fixtureConfigDoc.shelfConfig
                            .filter( ( shelf ) => shelf.shelfZone === configData.position )
                            .sort( ( a, b ) => a.shelfNumber - b.shelfNumber );

                        if ( imageMeta.imageShape === 'square' ) {
                          insertData.productHeight.value = 100;
                          insertData.productWidth.value = 230;

                          if ( shelfData.length ) {
                            insertData.startYPosition = shelfData[0].shelfNumber;
                            insertData.endYPosition = shelfData[shelfData.length - 1].shelfNumber;
                          }
                        }

                        // if ( imageMeta.imageShape === 'rectangle' ) {
                        //   insertData.productHeight.value = 100;
                        //   insertData.productWidth.value = 905;
                        // }
                      }

                      const vmTemplate = await planoProductService.upsertOne(
                          {
                            'productName': vm.productName,
                            'fixtureConfigId': fixtureConfig._id,
                            'productHeight.value': configData.vmHeightmm,
                            'productWidth.value': configData.vmWidthmm,
                            'startYPosition': configData.startShelf,
                            'endYPosition': configData.endShelf,
                            'xZone': configData.zone,
                          },
                          insertData,
                      );

                      const vmData = {
                        'clientId': layoutDoc.clientId,
                        'storeName': layoutDoc.storeName,
                        'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                        'planoId': layoutDoc.planoId,
                        'floorId': layoutDoc._id,
                        'type': 'vm',
                        'fixtureId': createdFixture._id,
                        'productId': vmTemplate._id,
                      };

                      await planoMappingService.upsertOne(
                          {
                            fixtureId: createdFixture._id,
                            productId: vmTemplate._id,
                          },
                          vmData,
                      );
                    } ),
                );
              } ) || [],
          );
        }


        for ( let index = 0; index < backFixtures.length; index++ ) {
          const fixture = backFixtures[index];

          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          const fixtureData = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
            'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
            'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureCode': fixtureConfigDoc?.fixtureCode,
            'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
            'fixtureType': 'wall',
            'fixtureHeight': {
              'value': 0,
              'unit': 'mm',
            },
            'fixtureLength': {
              'value': constantFixtureWidth,
              'unit': 'mm',
            },
            'fixtureWidth': {
              'value': constantFixtureLength,
              'unit': 'mm',
            },
            'associatedElementType': 'wall',
            'associatedElementNumber': 2,
            'relativePosition': {
              'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
              'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            'detailedFixtureLength': {
              'value': constantDetailedFixtureLength,
              'unit': 'mm',
            },
            'detailedFixtureWidth': {
              'value': constantDetailedFixtureWidth,
              'unit': 'mm',
            },
            'relativeDetailedPosition': {
              'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
              'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
              'unit': 'ft',
            },
            'productResolutionLevel': 'L2',
            'associatedElementFixtureNumber': index+1,
            'header': fixture.header,
            'footer': fixture.footer,
            'fixtureConfigId': fixtureConfigDoc._id,
          };

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          await Promise.all(
              fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
                const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
                const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

                const shelfData = {
                  'clientId': '11',
                  'storeName': layoutDoc.storeName,
                  'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                  'planoId': layoutDoc.planoId,
                  'floorId': layoutDoc._id,
                  'fixtureId': createdFixture._id,
                  'shelfNumber': j + 1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': configShelf.shelfCapacity,
                  'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                  'sectionZone': configShelf.shelfZone,
                  'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
                }; ;

                await fixtureShelfService.upsertOne(
                    {
                      fixtureId: createdFixture._id,
                      shelfNumber: j + 1,
                    },
                    shelfData,
                );
              } ),
          );

          await Promise.all(
              fixture.productZones?.map( async ( zone ) => {
                const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
                const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
                const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

                await Promise.all(
                    vms.map( async ( vm ) => {
                      let configData = vmConfig[0];

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                      }

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                      }

                      if ( !configData ) return;

                      let attachmentId = '';
                      let imgPath = '';
                      let imageMeta = null;


                      if ( zone.preview_image_url ) {
                        const parsedUrl = new URL( zone.preview_image_url );
                        attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

                        const isVmImageExist = await planoProductService.findOne( { crestImageId: attachmentId } );


                        if ( !isVmImageExist ) {
                          const vmImageData = await fetchVmImage( attachmentId );

                          imageMeta = await getImageMetadata( vmImageData );

                          const params = {
                            Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                            Key: `crestVms/`,
                            fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                            ContentType: imageMeta.contentType,
                            body: vmImageData,
                          };

                          const imgUpload = await fileUpload( params );

                          imgPath = imgUpload.Key;
                        }
                      }

                      const insertData = {
                        'clientId': '11',
                        'productId': 'VMCR',
                        'type': 'vm',
                        'productName': vm.productName,
                        'productHeight': {
                          'value': configData.vmHeightmm,
                          'unit': 'mm',
                        },
                        'productWidth': {
                          'value': configData.vmWidthmm,
                          'unit': 'mm',
                        },
                        'startYPosition': configData.startShelf,
                        'endYPosition': configData.endShelf,
                        'xZone': configData.zone,
                        'fixtureConfigId': fixtureConfig._id,
                      };

                      if ( attachmentId && imgPath ) {
                        insertData.crestImageId = attachmentId;
                        insertData.productImageUrl = imgPath;

                        const shelfData = fixtureConfigDoc.shelfConfig
                            .filter( ( shelf ) => shelf.shelfZone === configData.position )
                            .sort( ( a, b ) => a.shelfNumber - b.shelfNumber );

                        if ( imageMeta.imageShape === 'square' ) {
                          insertData.productHeight.value = 100;
                          insertData.productWidth.value = 230;

                          if ( shelfData.length ) {
                            insertData.startYPosition = shelfData[0].shelfNumber;
                            insertData.endYPosition = shelfData[shelfData.length - 1].shelfNumber;
                          }
                        }

                        // if ( imageMeta.imageShape === 'rectangle' ) {
                        //   insertData.productHeight.value = 100;
                        //   insertData.productWidth.value = 905;
                        // }
                      }

                      const vmTemplate = await planoProductService.upsertOne(
                          {
                            'productName': vm.productName,
                            'fixtureConfigId': fixtureConfig._id,
                            'productHeight.value': configData.vmHeightmm,
                            'productWidth.value': configData.vmWidthmm,
                            'startYPosition': configData.startShelf,
                            'endYPosition': configData.endShelf,
                            'xZone': configData.zone,
                          },
                          insertData,
                      );

                      const vmData = {
                        'clientId': layoutDoc.clientId,
                        'storeName': layoutDoc.storeName,
                        'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                        'planoId': layoutDoc.planoId,
                        'floorId': layoutDoc._id,
                        'type': 'vm',
                        'fixtureId': createdFixture._id,
                        'productId': vmTemplate._id,
                      };

                      await planoMappingService.upsertOne(
                          {
                            fixtureId: createdFixture._id,
                            productId: vmTemplate._id,
                          },
                          vmData,
                      );
                    } ),
                );
              } ) || [],
          );
        }

        for ( let index = 0; index < rightFixtures.length; index++ ) {
          const fixture = rightFixtures[index];

          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          const fixtureData = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
            'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
            'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
            'fixtureCode': fixtureConfigDoc?.fixtureCode,
            'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
            'fixtureType': 'wall',
            'fixtureHeight': {
              'value': 0,
              'unit': 'mm',
            },
            'fixtureLength': {
              'value': constantFixtureLength,
              'unit': 'mm',
            },
            'fixtureWidth': {
              'value': constantFixtureWidth,
              'unit': 'mm',
            },
            'associatedElementType': 'wall',
            'associatedElementNumber': 3,
            'relativePosition': {
              'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
              'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            'detailedFixtureLength': {
              'value': constantDetailedFixtureLength,
              'unit': 'mm',
            },
            'detailedFixtureWidth': {
              'value': constantDetailedFixtureWidth,
              'unit': 'mm',
            },
            'relativeDetailedPosition': {
              'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
              'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
              'unit': 'ft',
            },
            'productResolutionLevel': 'L2',
            'associatedElementFixtureNumber': index+1,
            'header': fixture.header,
            'footer': fixture.footer,
            'fixtureConfigId': fixtureConfigDoc._id,
          };

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          await Promise.all(
              fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
                const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
                const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

                const shelfData = {
                  'clientId': '11',
                  'storeName': layoutDoc.storeName,
                  'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                  'planoId': layoutDoc.planoId,
                  'floorId': layoutDoc._id,
                  'fixtureId': createdFixture._id,
                  'shelfNumber': j + 1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': configShelf.shelfCapacity,
                  'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                  'sectionZone': configShelf.shelfZone,
                  'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
                };

                await fixtureShelfService.upsertOne(
                    {
                      fixtureId: createdFixture._id,
                      shelfNumber: j + 1,
                    },
                    shelfData,
                );
              } ),
          );

          await Promise.all(
              fixture.productZones?.map( async ( zone ) => {
                const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
                const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
                const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

                await Promise.all(
                    vms.map( async ( vm ) => {
                      let configData = vmConfig[0];

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                      }

                      if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                        configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                      }

                      if ( !configData ) return;

                      let attachmentId = '';
                      let imgPath = '';
                      let imageMeta = null;


                      if ( zone.preview_image_url ) {
                        const parsedUrl = new URL( zone.preview_image_url );
                        attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

                        const isVmImageExist = await planoProductService.findOne( { crestImageId: attachmentId } );


                        if ( !isVmImageExist ) {
                          const vmImageData = await fetchVmImage( attachmentId );

                          imageMeta = await getImageMetadata( vmImageData );

                          const params = {
                            Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                            Key: `crestVms/`,
                            fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                            ContentType: imageMeta.contentType,
                            body: vmImageData,
                          };

                          const imgUpload = await fileUpload( params );

                          imgPath = imgUpload.Key;
                        }
                      }


                      const insertData = {
                        'clientId': '11',
                        'productId': 'VMCR',
                        'type': 'vm',
                        'productName': vm.productName,
                        'productHeight': {
                          'value': configData.vmHeightmm,
                          'unit': 'mm',
                        },
                        'productWidth': {
                          'value': configData.vmWidthmm,
                          'unit': 'mm',
                        },
                        'startYPosition': configData.startShelf,
                        'endYPosition': configData.endShelf,
                        'xZone': configData.zone,
                        'fixtureConfigId': fixtureConfig._id,
                      };

                      if ( attachmentId && imgPath ) {
                        insertData.crestImageId = attachmentId;
                        insertData.productImageUrl = imgPath;

                        const shelfData = fixtureConfigDoc.shelfConfig
                            .filter( ( shelf ) => shelf.shelfZone === configData.position )
                            .sort( ( a, b ) => a.shelfNumber - b.shelfNumber );

                        if ( imageMeta.imageShape === 'square' ) {
                          insertData.productHeight.value = 100;
                          insertData.productWidth.value = 230;

                          if ( shelfData.length ) {
                            insertData.startYPosition = shelfData[0].shelfNumber;
                            insertData.endYPosition = shelfData[shelfData.length - 1].shelfNumber;
                          }
                        }

                        // if ( imageMeta.imageShape === 'rectangle' ) {
                        //   insertData.productHeight.value = 100;
                        //   insertData.productWidth.value = 905;
                        // }
                      }

                      const vmTemplate = await planoProductService.upsertOne(
                          {
                            'productName': vm.productName,
                            'fixtureConfigId': fixtureConfig._id,
                            'productHeight.value': configData.vmHeightmm,
                            'productWidth.value': configData.vmWidthmm,
                            'startYPosition': configData.startShelf,
                            'endYPosition': configData.endShelf,
                            'xZone': configData.zone,
                          },
                          insertData,
                      );

                      const vmData = {
                        'clientId': layoutDoc.clientId,
                        'storeName': layoutDoc.storeName,
                        'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                        'planoId': layoutDoc.planoId,
                        'floorId': layoutDoc._id,
                        'type': 'vm',
                        'fixtureId': createdFixture._id,
                        'productId': vmTemplate._id,
                      };

                      await planoMappingService.upsertOne(
                          {
                            fixtureId: createdFixture._id,
                            productId: vmTemplate._id,
                          },
                          vmData,
                      );
                    } ),
                );
              } ) || [],
          );
        }


        for ( let index = 0; index < floorFixtures.length; index++ ) {
          const fixture = floorFixtures[index];
          const centerRow = Math.floor( totalRows / 2 );

          const startingX = roundToTwo( ( finalXDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) );
          const detailedStartingX = roundToTwo( ( finalXDetailedDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) );

          const startingY = finalYDistance / 2 - centerRow * ( constantFixtureWidth / mmToFeet );
          const detailedStartingY = finalYDetailedDistance / 2 - centerRow * ( constantDetailedFixtureWidth / mmToFeet );

          const colIndex = Math.floor( index / 2 );
          const rowIndex = index % 2 === 0 ? 1 : 0;

          const xPos = roundToTwo( startingX + colIndex * ( constantFixtureLength / mmToFeet ) );
          const yPos = roundToTwo( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) );

          const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
          const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

          const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.main } );
          if ( !fixtureConfig ) continue;

          const fixtureConfigDoc = fixtureConfig.toObject();

          const fixtureData = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'fixtureName': `Fixture ${index+1} - ${fixture.main}`,
            'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
            'fixtureBrandCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
            'fixtureBrandSubCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
            'fixtureCode': fixtureConfigDoc?.fixtureCode,
            'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
            'fixtureType': 'floor',
            'fixtureHeight': {
              'value': 0,
              'unit': 'mm',
            },
            'fixtureLength': {
              'value': constantFixtureLength,
              'unit': 'mm',
            },
            'fixtureWidth': {
              'value': constantFixtureWidth,
              'unit': 'mm',
            },
            'relativePosition': {
              'x': xPos,
              'y': yPos,
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            'detailedFixtureLength': {
              'value': constantDetailedFixtureLength,
              'unit': 'mm',
            },
            'detailedFixtureWidth': {
              'value': constantDetailedFixtureWidth,
              'unit': 'mm',
            },
            'relativeDetailedPosition': {
              'x': detailedXPos,
              'y': detailedYPos,
              'unit': 'ft',
            },
            'productResolutionLevel': 'L2',
            'associatedElementFixtureNumber': index+1,
            'fixtureConfigId': fixtureConfigDoc._id,
          };


          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          await Promise.all(
              fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
                const shelfSection = fixture.centerSuperSubMain.find(
                    ( product ) => product.isVisualMerchandiser === false || product.isVisualMerchandiser === true,
                );

                const shelfData = {
                  'clientId': '11',
                  'storeName': layoutDoc.storeName,
                  'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
                  'planoId': layoutDoc.planoId,
                  'floorId': layoutDoc._id,
                  'fixtureId': createdFixture._id,
                  'shelfNumber': j + 1,
                  'shelfOrder': 'LTR',
                  'shelfCapacity': configShelf.shelfCapacity,
                  'sectionName': fixture.centerSuperSubMain.find( ( product ) => product.isVisualMerchandiser === true ) ? shelfSection?.name + ' PIDs' : shelfSection?.name,
                  'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
                };

                await fixtureShelfService.upsertOne(
                    {
                      fixtureId: createdFixture._id,
                      shelfNumber: j + 1,
                    },
                    shelfData,
                );
              } ),
          );

          const vm = fixture.centerSuperSubMain.find( ( vm ) => vm.isVisualMerchandiser );
          const vmConfig = fixtureConfigDoc.vmConfig;

          if ( vm ) {
            const [ configData1, configData2 ] = [ vmConfig[0], vmConfig[1] ];

            const insertData1 = {
              'clientId': '11',
              'productId': 'VMCR',
              'type': 'vm',
              'productName': vm.name,
              'productHeight': {
                'value': configData1.vmHeightmm,
                'unit': 'mm',
              },
              'productWidth': {
                'value': configData1.vmWidthmm,
                'unit': 'mm',
              },
              'startYPosition': configData1.startShelf,
              'endYPosition': configData1.endShelf,
              'xZone': configData1.zone,
              'fixtureConfigId': fixtureConfig._id,
            };
            const insertData2 = {
              'clientId': '11',
              'productId': 'VMCR',
              'type': 'vm',
              'productName': ' ',
              'productHeight': {
                'value': configData2.vmHeightmm,
                'unit': 'mm',
              },
              'productWidth': {
                'value': configData2.vmWidthmm,
                'unit': 'mm',
              },
              'startYPosition': configData2.startShelf,
              'endYPosition': configData2.endShelf,
              'xZone': configData2.zone,
              'fixtureConfigId': fixtureConfig._id,
            };

            const [ vmTemplate1, vmTemplate2 ] = await Promise.all( [
              planoProductService.upsertOne(
                  {
                    'productName': vm.name,
                    'fixtureConfigId': fixtureConfig._id,
                    'productHeight.value': configData1.vmHeightmm,
                    'productWidth.value': configData1.vmWidthmm,
                    'startYPosition': configData1.startShelf,
                    'endYPosition': configData1.endShelf,
                    'xZone': configData1.zone,
                  },
                  insertData1,
              ),
              planoProductService.upsertOne(
                  {
                    'productName': ' ',
                    'fixtureConfigId': fixtureConfig._id,
                    'productHeight.value': configData2.vmHeightmm,
                    'productWidth.value': configData2.vmWidthmm,
                    'startYPosition': configData2.startShelf,
                    'endYPosition': configData2.endShelf,
                    'xZone': configData2.zone,
                  },
                  insertData2,
              ),
            ] );

            const vmData1 = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate1._id,
            };
            const vmData2 = {
              'clientId': layoutDoc.clientId,
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'type': 'vm',
              'fixtureId': createdFixture._id,
              'productId': vmTemplate2._id,
            };

            await Promise.all( [
              planoMappingService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    productId: vmTemplate1._id,
                  },
                  vmData1,
              ),
              planoMappingService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    productId: vmTemplate2._id,
                  },
                  vmData2,
              ),
            ] );
          }
        }

        const now = Date.now();
        const elapsedMinutes = ( now - startTime ) / 1000 / 60;
        console.log( `Store name: ${storeData.storeName},Floor name: ${floorArray[floorIndex]} Iteration ${i + 1}/${storeList?.length}: total elapsed time = ${elapsedMinutes.toFixed( 2 )} minutes` );
        logger.info( { functionName: 'updateCrestPlanogram', body: `Store name: ${storeData.storeName},Floor name: ${floorArray[floorIndex]} Iteration ${i + 1}/${storeList?.length}: total elapsed time = ${elapsedMinutes.toFixed( 2 )} minutes` } );
      }
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateCrestPlanogram', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function getVideoLinks( req, res ) {
  if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
    return res.sendError( 'Unauthorized', 401 );
  }
  try {
    const query = [
      {
        $match: {
          date_string: { $gte: req.body.fromDate, $lte: req.body.toDate },
          type: 'layout',
          status: req.body.status,
        },
      },
      {
        $lookup: {
          from: 'planograms',
          let: { plano_id: '$planoId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [ '$_id', '$$plano_id' ] },
                  ],
                },
              },
            },
            {
              $project: {
                storeName: 1,
                _id: 0,
              },
            },
          ],
          as: 'planogram',
        },
      },
      { $unwind: { path: '$planogram', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          storeName: '$planogram.storeName',
          answers: 1,
          type: 1,
          status: 1,
          planoId: 1,
          floorId: 1,
        },
      },
    ];
    const responseData = await planoTaskService.aggregate( query );

    const videoData = [];

    const seenStores = new Set();

    for ( const data of responseData ) {
      const store = await planoService.findOne( { _id: data.planoId } );
      if ( seenStores.has( store?.toObject()?.storeName ) ) {
        continue;
      }
      const [ q1, q2, q3 ] = data.answers;
      console.log( q1, q2 );
      const params = {
        Bucket: 'tango-planogram',
        file_path: q3?.video || null,
      };

      const videoUrl = await signedUrl( params );

      videoData.push( {
        date: data.date_string,
        store: store?.toObject()?.storeName,
        videoUrl,
      } );

      seenStores.add( store?.toObject()?.storeName );
    }

    const resData = {
      count: videoData.length,
      data: videoData,
    };

    res.sendSuccess( resData );
  } catch ( e ) {
    console.log( e );
    return res.sendError( e, 500 );
  }
}

export async function updateExcelPlanogram( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    const startTime = Date.now();

    const workbook = xlsx.read( req.files.file.data, { type: 'buffer' } );
    const sheetName = 'Sheet1';
    const raw = xlsx.utils.sheet_to_json( workbook.Sheets[sheetName] );

    const storeNames = new Set();

    raw.forEach( ( entry ) => storeNames.add( entry?.['Store ID'] ) );

    const storeNameArr = Array.from( storeNames );

    const storeList = await storeService.find( { clientId: '11', storeName: { $in: storeNameArr } }, { storeName: 1, storeId: 1 } );

    function transformFixtureData( inputData ) {
      const storeMap = new Map();

      inputData.forEach( ( item ) => {
        const storeName = item['Store ID'];
        if ( !storeMap.has( storeName ) ) {
          storeMap.set( storeName, [] );
        }
        storeMap.get( storeName ).push( item );
      } );

      const result = [];

      for ( const [ storeName, storeItems ] of storeMap.entries() ) {
        const wallGroups = new Map();
        const fixtureGroupMap = new Map();

        function addZoneProduct( fixture, zoneName, productName, isVM ) {
          let zone = fixture.productZones.find( ( z ) => z.zoneName === zoneName );
          if ( !zone ) {
            zone = { zoneName, products: [] };
            fixture.productZones.push( zone );
          }

          if ( !zone.products.some( ( p ) => p.productName === productName && p.isMerchandisingElement === isVM ) ) {
            zone.products.push( {
              productName,
              isMerchandisingElement: isVM,
            } );
          }
        }

        storeItems.forEach( ( item ) => {
          const wall = item.Wall || 'Unknown';
          const locator = item['Store Fixture Locator'];
          const wallUpper = wall.toUpperCase();
          const isCenterWall = wallUpper.includes( 'CENTRE' );
          const fixtureKey = wall + '::' + locator;

          if ( !fixtureGroupMap.has( fixtureKey ) ) {
            if ( isCenterWall ) {
              console.log();
              fixtureGroupMap.set( fixtureKey, {
                type: 'center',
                id: item['Store Fixture ID'],
                main: item['Fixture Type'],
                centerSubMain: item['Brand-Category'],
                fixtureLocator: locator,
                centerSuperSubMain: [
                  {
                    name: item['Brand-Category'],
                    isVisualMerchandiser: false,
                  },
                ],
              } );
            } else {
              fixtureGroupMap.set( fixtureKey, {
                type: 'wall',
                id: item['Store Fixture ID'],
                footer: 'Storage Box',
                header: item['Brand-Category'],
                fixtureName: `${locator} - ${item['Fixture Type']}`,
                fixtureType: item['Fixture Type'],
                productZones: [],
                fixtureSpacing: 0,
                fixtureSubname: [ item['Brand - Sub Category'] ],
                wall: wallUpper + ' WALL',
              } );
            }
          }

          const fixture = fixtureGroupMap.get( fixtureKey );

          if ( fixture.type === 'wall' ) {
            if ( item.VM ) addZoneProduct( fixture, item.Zone, item.VM, true );
            if ( item.Allocation ) addZoneProduct( fixture, item.Zone, item.Allocation, false );
          }
        } );

        const structuredData = [];

        for ( const fixture of fixtureGroupMap.values() ) {
          if ( fixture.type === 'center' ) {
            structuredData.push( {
              id: fixture.id,
              main: fixture.main,
              centerSubMain: fixture.centerSubMain,
              fixtureLocator: fixture.fixtureLocator,
              centerSuperSubMain: fixture.centerSuperSubMain,
            } );
          } else {
            const wallName = fixture.wall;
            if ( !wallGroups.has( wallName ) ) {
              wallGroups.set( wallName, {
                main: wallName,
                fixtures: [],
              } );
            }
            wallGroups.get( wallName ).fixtures.push( fixture );
          }
        }

        result.push( {
          storeName,
          data: [
            ...Array.from( wallGroups.values() ),
            ...structuredData,
          ],
        } );
      }

      return result;
    }


    const finalData = transformFixtureData( raw );


    const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }

    for ( let i = 0; i < storeList.length; i++ ) {
      const storeData = finalData.find( ( store ) => store.storeName === storeList[i].toObject().storeName );

      const storeDetails = storeList[i];

      const existingPlanogram = await planoService.findOne( { storeName: storeData.storeName } );

      if ( existingPlanogram ) {
        const checkTaskSubmitted = await planoTaskService.findOne( { planoId: existingPlanogram.toObject()._id } );

        const checkTaskCreated = await processedTaskService.findOne( { storeName: storeData.storeName, date_iso: { $gte: new Date( ), $lte: new Date( ) }, isPlano: true } );

        if ( checkTaskSubmitted || checkTaskCreated ) {
          continue;
        }
      }


      if ( existingPlanogram?.toObject()?._id && mongoose.Types.ObjectId.isValid( existingPlanogram?.toObject()?._id ) ) {
        await Promise.all( [ planoService.deleteOne( { _id: existingPlanogram?.toObject()?._id } ), storeBuilderService.deleteOne( { planoId: existingPlanogram?.toObject()?._id } ),
          storeFixtureService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ), fixtureShelfService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
          planoMappingService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
        ] );
      }


      const planoInsertData = {
        storeName: storeData.storeName,
        storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
        layoutName: `${storeData.storeName} - Layout`,
        clientId: '11',
        attachments: [],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        floorNumber: 1,
        productResolutionLevel: 'L2',
        scanType: 'qr',
      };

      const insertedPlano = await planoService.upsertOne( { storeName: storeData.storeName }, planoInsertData );
      const planoDoc = insertedPlano.toObject();

      const leftWall = storeData.data.filter( ( entry ) => entry['main'] === 'LEFT WALL' );
      const leftFixtures = leftWall.flatMap( ( wall ) => wall.fixtures );
      const rightWall = storeData.data.filter( ( entry ) => entry['main'] === 'RIGHT WALL' );
      const rightFixtures = rightWall.flatMap( ( wall ) => wall.fixtures );
      const backWall = storeData.data.filter( ( entry ) => entry['main'] === 'BACK WALL' );
      const backFixtures = backWall.flatMap( ( wall ) => wall.fixtures );
      const frontWall = storeData.data.filter( ( entry ) => entry['main'] === 'FRONT WALL' );
      const frontFixtures = frontWall.flatMap( ( wall ) => wall.fixtures );
      const floorFixtures = storeData.data.filter( ( entry ) => entry['main'] === 'Euro Center' );


      const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
      const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

      const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

      const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

      const maxFixturesPerRow = floorFixtures.length/2;
      const totalRows = 2;

      const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantFixtureLength / mmToFeet ) ) ) : 0;
      const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

      const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( 2 * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
      const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( 2 * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

      const frontXDistanceFeet = frontFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const frontXDetailedDistanceFeet = frontFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const frontYDistanceFeet = frontFixtures.length ? roundToTwo( ( ( frontFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const frontYDetailedDistanceFeet = frontFixtures.length ? roundToTwo( ( ( frontFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
      const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

      const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
      const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

      const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
      const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

      const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet, frontYDistanceFeet );
      const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet, frontYDetailedDistanceFeet );

      const finalXDistance = roundToTwo( ( maxXDistance < ( backXDistanceFeet + floorXDistanceFeet + frontXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet + frontXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance ) );
      const finalXDetailedDistance = roundToTwo( ( maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet + frontXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet + frontXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance ) );

      const finalYDistance = roundToTwo( ( maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) ) ) );
      const finalYDetailedDistance = roundToTwo( ( maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) ) ) );


      const floorInsertData = {
        storeName: planoDoc.storeName,
        storeId: planoDoc.storeId,
        layoutName: `${planoDoc.storeName} - Layout`,
        clientId: '11',
        floorNumber: 1,
        floorName: 'floor 1',
        layoutPolygon: [
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalYDistance,
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: finalYDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: finalXDistance,
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: finalXDetailedDistance,
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
          {
            elementType: 'entrance',
            distance: roundToTwo( ( ( finalYDistance * 20 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
          },
          {
            elementType: 'wall',
            distance: roundToTwo( ( ( finalYDistance * 40 ) / 100 ) ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
          },
        ],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        planoId: planoDoc._id,
      };

      const layoutDoc = await storeBuilderService.upsertOne( { planoId: planoDoc._id }, floorInsertData );

      let fixtureCounter = 1;
      const frontFixturePromises = frontFixtures.map( async ( fixture, index ) => {
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) return;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 2,
          'relativePosition': {
            'x': 0,
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( frontFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': 0,
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( frontFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter++,
            },
            fixtureData,
        );

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) return;

        await Promise.all(
            fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
              const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
              const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

              const shelfData = {
                'clientId': '11',
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': j + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': configShelf.shelfCapacity,
                'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                'sectionZone': configShelf.shelfZone,
                'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
              }; ;

              await fixtureShelfService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    shelfNumber: j + 1,
                  },
                  shelfData,
              );
            } ),
        );

        await Promise.all(
            fixture.productZones?.map( async ( zone ) => {
              const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
              const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
              const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

              await Promise.all(
                  vms.map( async ( vm ) => {
                    let configData = vmConfig[0];

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                    }

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                    }

                    if ( !configData ) return;

                    const insertData = {
                      'clientId': '11',
                      'productId': 'VMCR',
                      'type': 'vm',
                      'productName': vm.productName,
                      'productHeight': {
                        'value': configData.vmHeightmm,
                        'unit': 'mm',
                      },
                      'productWidth': {
                        'value': configData.vmWidthmm,
                        'unit': 'mm',
                      },
                      'startYPosition': configData.startShelf,
                      'endYPosition': configData.endShelf,
                      'xZone': configData.zone,
                      'fixtureConfigId': fixtureConfig._id,
                    };

                    const vmTemplate = await planoProductService.upsertOne(
                        {
                          'productName': vm.productName,
                          'fixtureConfigId': fixtureConfig._id,
                          'productHeight.value': configData.vmHeightmm,
                          'productWidth.value': configData.vmWidthmm,
                          'startYPosition': configData.startShelf,
                          'endYPosition': configData.endShelf,
                          'xZone': configData.zone,
                        },
                        insertData,
                    );

                    const vmData = {
                      'clientId': layoutDoc.clientId,
                      'storeName': layoutDoc.storeName,
                      'storeId': layoutDoc.storeId,
                      'planoId': layoutDoc.planoId,
                      'floorId': layoutDoc._id,
                      'type': 'vm',
                      'fixtureId': createdFixture._id,
                      'productId': vmTemplate._id,
                    };

                    await planoMappingService.upsertOne(
                        {
                          fixtureId: createdFixture._id,
                          productId: vmTemplate._id,
                        },
                        vmData,
                    );
                  } ),
              );
            } ) || [],
        );
      } );

      const leftFixturePromises = leftFixtures.map( async ( fixture, index ) => {
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) return;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 1,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter++,
            },
            fixtureData,
        );

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) return;

        await Promise.all(
            fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
              const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
              const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

              const shelfData = {
                'clientId': '11',
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': j + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': configShelf.shelfCapacity,
                'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                'sectionZone': configShelf.shelfZone,
                'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
              };

              await fixtureShelfService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    shelfNumber: j + 1,
                  },
                  shelfData,
              );
            } ),
        );

        await Promise.all(
            fixture.productZones?.map( async ( zone ) => {
              const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
              const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
              const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

              await Promise.all(
                  vms.map( async ( vm ) => {
                    let configData = vmConfig[0];

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                    }

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                    }

                    if ( !configData ) return;

                    const insertData = {
                      'clientId': '11',
                      'productId': 'VMCR',
                      'type': 'vm',
                      'productName': vm.productName,
                      'productHeight': {
                        'value': configData.vmHeightmm,
                        'unit': 'mm',
                      },
                      'productWidth': {
                        'value': configData.vmWidthmm,
                        'unit': 'mm',
                      },
                      'startYPosition': configData.startShelf,
                      'endYPosition': configData.endShelf,
                      'xZone': configData.zone,
                      'fixtureConfigId': fixtureConfig._id,
                    };

                    const vmTemplate = await planoProductService.upsertOne(
                        {
                          'productName': vm.productName,
                          'fixtureConfigId': fixtureConfig._id,
                          'productHeight.value': configData.vmHeightmm,
                          'productWidth.value': configData.vmWidthmm,
                          'startYPosition': configData.startShelf,
                          'endYPosition': configData.endShelf,
                          'xZone': configData.zone,
                        },
                        insertData,
                    );

                    const vmData = {
                      'clientId': layoutDoc.clientId,
                      'storeName': layoutDoc.storeName,
                      'storeId': layoutDoc.storeId,
                      'planoId': layoutDoc.planoId,
                      'floorId': layoutDoc._id,
                      'type': 'vm',
                      'fixtureId': createdFixture._id,
                      'productId': vmTemplate._id,
                    };

                    await planoMappingService.upsertOne(
                        {
                          fixtureId: createdFixture._id,
                          productId: vmTemplate._id,
                        },
                        vmData,
                    );
                  } ),
              );
            } ) || [],
        );
      } );

      const backFixturePromises = backFixtures.map( async ( fixture, index ) => {
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) return;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 2,
          'relativePosition': {
            'x': roundToTwo( ( finalXDistance - ( constantFixtureWidth/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantFixtureLength/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter++,
            },
            fixtureData,
        );

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) return;

        await Promise.all(
            fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
              const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
              const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

              const shelfData = {
                'clientId': '11',
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': j + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': configShelf.shelfCapacity,
                'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                'sectionZone': configShelf.shelfZone,
                'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
              }; ;

              await fixtureShelfService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    shelfNumber: j + 1,
                  },
                  shelfData,
              );
            } ),
        );

        await Promise.all(
            fixture.productZones?.map( async ( zone ) => {
              const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
              const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
              const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

              await Promise.all(
                  vms.map( async ( vm ) => {
                    let configData = vmConfig[0];

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                    }

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                    }

                    if ( !configData ) return;

                    const insertData = {
                      'clientId': '11',
                      'productId': 'VMCR',
                      'type': 'vm',
                      'productName': vm.productName,
                      'productHeight': {
                        'value': configData.vmHeightmm,
                        'unit': 'mm',
                      },
                      'productWidth': {
                        'value': configData.vmWidthmm,
                        'unit': 'mm',
                      },
                      'startYPosition': configData.startShelf,
                      'endYPosition': configData.endShelf,
                      'xZone': configData.zone,
                      'fixtureConfigId': fixtureConfig._id,
                    };

                    const vmTemplate = await planoProductService.upsertOne(
                        {
                          'productName': vm.productName,
                          'fixtureConfigId': fixtureConfig._id,
                          'productHeight.value': configData.vmHeightmm,
                          'productWidth.value': configData.vmWidthmm,
                          'startYPosition': configData.startShelf,
                          'endYPosition': configData.endShelf,
                          'xZone': configData.zone,
                        },
                        insertData,
                    );

                    const vmData = {
                      'clientId': layoutDoc.clientId,
                      'storeName': layoutDoc.storeName,
                      'storeId': layoutDoc.storeId,
                      'planoId': layoutDoc.planoId,
                      'floorId': layoutDoc._id,
                      'type': 'vm',
                      'fixtureId': createdFixture._id,
                      'productId': vmTemplate._id,
                    };

                    await planoMappingService.upsertOne(
                        {
                          fixtureId: createdFixture._id,
                          productId: vmTemplate._id,
                        },
                        vmData,
                    );
                  } ),
              );
            } ) || [],
        );
      } );

      const rightFixturePromises = rightFixtures.map( async ( fixture, index ) => {
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.fixtureType } );
        if ( !fixtureConfig ) return;
        const fixtureConfigDoc = fixtureConfig.toObject();

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.fixtureType}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureBrandSubCategory': fixture.fixtureSubname.length ? ( fixture.fixtureSubname.length > 1 ? fixture.fixtureSubname.join( ' + ' ) : fixture.fixtureSubname[0] ) : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'wall',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'associatedElementType': 'wall',
          'associatedElementNumber': 3,
          'relativePosition': {
            'x': roundToTwo( ( index * ( constantFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDistance - ( constantFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'header': fixture.header,
          'footer': fixture.footer,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter++,
            },
            fixtureData,
        );

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) return;

        await Promise.all(
            fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
              const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
              const shelfSection = shelfZone.products.find( ( product ) => !product.isMerchandisingElement );

              const shelfData = {
                'clientId': '11',
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': j + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': configShelf.shelfCapacity,
                'sectionName': shelfSection?.productName ? shelfSection.productName : 'Unknown',
                'sectionZone': configShelf.shelfZone,
                'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
              };

              await fixtureShelfService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    shelfNumber: j + 1,
                  },
                  shelfData,
              );
            } ),
        );

        await Promise.all(
            fixture.productZones?.map( async ( zone ) => {
              const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
              const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
              const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

              await Promise.all(
                  vms.map( async ( vm ) => {
                    let configData = vmConfig[0];

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                    }

                    if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                      configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
                    }

                    if ( !configData ) return;

                    const insertData = {
                      'clientId': '11',
                      'productId': 'VMCR',
                      'type': 'vm',
                      'productName': vm.productName,
                      'productHeight': {
                        'value': configData.vmHeightmm,
                        'unit': 'mm',
                      },
                      'productWidth': {
                        'value': configData.vmWidthmm,
                        'unit': 'mm',
                      },
                      'startYPosition': configData.startShelf,
                      'endYPosition': configData.endShelf,
                      'xZone': configData.zone,
                      'fixtureConfigId': fixtureConfig._id,
                    };

                    const vmTemplate = await planoProductService.upsertOne(
                        {
                          'productName': vm.productName,
                          'fixtureConfigId': fixtureConfig._id,
                          'productHeight.value': configData.vmHeightmm,
                          'productWidth.value': configData.vmWidthmm,
                          'startYPosition': configData.startShelf,
                          'endYPosition': configData.endShelf,
                          'xZone': configData.zone,
                        },
                        insertData,
                    );

                    const vmData = {
                      'clientId': layoutDoc.clientId,
                      'storeName': layoutDoc.storeName,
                      'storeId': layoutDoc.storeId,
                      'planoId': layoutDoc.planoId,
                      'floorId': layoutDoc._id,
                      'type': 'vm',
                      'fixtureId': createdFixture._id,
                      'productId': vmTemplate._id,
                    };

                    await planoMappingService.upsertOne(
                        {
                          fixtureId: createdFixture._id,
                          productId: vmTemplate._id,
                        },
                        vmData,
                    );
                  } ),
              );
            } ) || [],
        );
      } );

      const floorFixturePromises = floorFixtures.map( async ( fixture, index ) => {
        const centerRow = Math.floor( totalRows / 2 );

        const startingX = roundToTwo( ( finalXDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) );
        const detailedStartingX = roundToTwo( ( finalXDetailedDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) );

        const startingY = finalYDistance / 2 - centerRow * ( constantFixtureWidth / mmToFeet );
        const detailedStartingY = finalYDetailedDistance / 2 - centerRow * ( constantDetailedFixtureWidth / mmToFeet );

        const colIndex = Math.floor( index / 2 );
        const rowIndex = index % 2 === 0 ? 1 : 0;

        const xPos = roundToTwo( startingX + colIndex * ( constantFixtureLength / mmToFeet ) );
        const yPos = roundToTwo( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) );

        const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
        const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

        console.log( fixture );

        console.log( fixture.main );
        const fixtureConfig = await fixtureConfigService.findOne( { fixtureCategory: fixture.main } );
        if ( !fixtureConfig ) return;

        const fixtureConfigDoc = fixtureConfig.toObject();

        console.log( fixtureConfigDoc );

        const fixtureData = {
          'clientId': layoutDoc.clientId,
          'storeName': layoutDoc.storeName,
          'storeId': layoutDoc.storeId,
          'planoId': layoutDoc.planoId,
          'floorId': layoutDoc._id,
          'fixtureName': `Fixture ${index+1} - ${fixture.main}`,
          'fixtureCategory': fixtureConfigDoc.fixtureConfigType,
          'fixtureBrandCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
          'fixtureBrandSubCategory': fixture.centerSubMain ? fixture.centerSubMain : undefined,
          'fixtureCode': fixtureConfigDoc?.fixtureCode,
          'fixtureCapacity': fixtureConfigDoc?.fixtureCapacity,
          'fixtureType': 'floor',
          'fixtureHeight': {
            'value': 0,
            'unit': 'mm',
          },
          'fixtureLength': {
            'value': constantFixtureLength,
            'unit': 'mm',
          },
          'fixtureWidth': {
            'value': constantFixtureWidth,
            'unit': 'mm',
          },
          'relativePosition': {
            'x': xPos,
            'y': yPos,
            'unit': 'ft',
          },
          'fixtureNumber': fixtureCounter,
          'detailedFixtureLength': {
            'value': constantDetailedFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFixtureWidth,
            'unit': 'mm',
          },
          'relativeDetailedPosition': {
            'x': detailedXPos,
            'y': detailedYPos,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
          'associatedElementFixtureNumber': index+1,
          'fixtureConfigId': fixtureConfigDoc._id,
        };

        console.log( fixtureData );


        const createdFixture = await storeFixtureService.upsertOne(
            {
              floorId: layoutDoc._id,
              fixtureNumber: fixtureCounter++,
            },
            fixtureData,
        );

        if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) return;

        await Promise.all(
            fixtureConfigDoc.shelfConfig.map( async ( configShelf, j ) => {
              const shelfSection = fixture.centerSuperSubMain.find(
                  ( product ) => product.isVisualMerchandiser === false || product.isVisualMerchandiser === true,
              );

              const shelfData = {
                'clientId': '11',
                'storeName': layoutDoc.storeName,
                'storeId': layoutDoc.storeId,
                'planoId': layoutDoc.planoId,
                'floorId': layoutDoc._id,
                'fixtureId': createdFixture._id,
                'shelfNumber': j + 1,
                'shelfOrder': 'LTR',
                'shelfCapacity': configShelf.shelfCapacity,
                'sectionName': fixture.centerSuperSubMain.find( ( product ) => product.isVisualMerchandiser === true ) ? shelfSection?.name + ' PIDs' : shelfSection?.name,
                'shelfSplitup': configShelf?.shelfSplitup ? configShelf.shelfSplitup : 0,
              };

              await fixtureShelfService.upsertOne(
                  {
                    fixtureId: createdFixture._id,
                    shelfNumber: j + 1,
                  },
                  shelfData,
              );
            } ),
        );

        const vm = fixture.centerSuperSubMain.find( ( vm ) => vm.isVisualMerchandiser );
        const vmConfig = fixtureConfigDoc.vmConfig;

        if ( vm ) {
          const [ configData1, configData2 ] = [ vmConfig[0], vmConfig[1] ];

          const insertData1 = {
            'clientId': '11',
            'productId': 'VMCR',
            'type': 'vm',
            'productName': vm.name,
            'productHeight': {
              'value': configData1.vmHeightmm,
              'unit': 'mm',
            },
            'productWidth': {
              'value': configData1.vmWidthmm,
              'unit': 'mm',
            },
            'startYPosition': configData1.startShelf,
            'endYPosition': configData1.endShelf,
            'xZone': configData1.zone,
            'fixtureConfigId': fixtureConfig._id,
          };
          const insertData2 = {
            'clientId': '11',
            'productId': 'VMCR',
            'type': 'vm',
            'productName': ' ',
            'productHeight': {
              'value': configData2.vmHeightmm,
              'unit': 'mm',
            },
            'productWidth': {
              'value': configData2.vmWidthmm,
              'unit': 'mm',
            },
            'startYPosition': configData2.startShelf,
            'endYPosition': configData2.endShelf,
            'xZone': configData2.zone,
            'fixtureConfigId': fixtureConfig._id,
          };

          const [ vmTemplate1, vmTemplate2 ] = await Promise.all( [
            planoProductService.upsertOne(
                {
                  'productName': vm.name,
                  'fixtureConfigId': fixtureConfig._id,
                  'productHeight.value': configData1.vmHeightmm,
                  'productWidth.value': configData1.vmWidthmm,
                  'startYPosition': configData1.startShelf,
                  'endYPosition': configData1.endShelf,
                  'xZone': configData1.zone,
                },
                insertData1,
            ),
            planoProductService.upsertOne(
                {
                  'productName': ' ',
                  'fixtureConfigId': fixtureConfig._id,
                  'productHeight.value': configData2.vmHeightmm,
                  'productWidth.value': configData2.vmWidthmm,
                  'startYPosition': configData2.startShelf,
                  'endYPosition': configData2.endShelf,
                  'xZone': configData2.zone,
                },
                insertData2,
            ),
          ] );

          const vmData1 = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'type': 'vm',
            'fixtureId': createdFixture._id,
            'productId': vmTemplate1._id,
          };
          const vmData2 = {
            'clientId': layoutDoc.clientId,
            'storeName': layoutDoc.storeName,
            'storeId': layoutDoc.storeId,
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'type': 'vm',
            'fixtureId': createdFixture._id,
            'productId': vmTemplate2._id,
          };

          await Promise.all( [
            planoMappingService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  productId: vmTemplate1._id,
                },
                vmData1,
            ),
            planoMappingService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  productId: vmTemplate2._id,
                },
                vmData2,
            ),
          ] );
        }
      } );

      await Promise.all( [ ...frontFixturePromises, ...leftFixturePromises, ...backFixturePromises, ...rightFixturePromises, ...floorFixturePromises ] );

      const now = Date.now();
      const elapsedMinutes = ( now - startTime ) / 1000 / 60;
      console.log( `Store name: ${storeData.storeName}, Iteration ${i + 1}: total elapsed time = ${elapsedMinutes.toFixed( 2 )} minutes` );
    }

    res.sendSuccess( finalData );
  } catch ( e ) {
    logger.error( { functionName: 'updateCrestPlanogram', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

// async function downloadImage() {
//   const url = 'https://api.getcrest.ai/api/ms_data_preparation/master_data/attachment/?preview=0&attachment_id=2934';

// try {
//   const response = await fetch( url, {
//     headers: {
//       Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3MjE0MjcxLCJpYXQiOjE3NDcyMTA2NzEsImp0aSI6ImM4ZjQ4ZDY2YWJkYzRmNDU4MWI4OGE4MTMwODVjOTUwIiwidXNlcl9pZCI6MTA4NSwiaWQiOjEwODUsImlzX21lZXNlZWtfYWNjb3VudCI6ZmFsc2UsImN1c3RvbWVyX2dyb3VwIjozOTgsImxpY2VuY2Vfc2NvcGVzIjpbeyJyZXNvdXJjZV9zZXQiOiJwcF9zZXQiLCJzY29wZV9yb2xlIjoiY29udHJpYnV0b3IifSx7InJlc291cmNlX3NldCI6ImRwX3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9LHsicmVzb3VyY2Vfc2V0IjoiZGZfc2V0Iiwic2NvcGVfcm9sZSI6ImNvbnRyaWJ1dG9yIn0seyJyZXNvdXJjZV9zZXQiOiJkZWZhdWx0X3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9XX0.IOw_0yNA6CMBCIn7cxjPR0FqHI949WplCKzlkr8aK7g',
//       Cookie: 'prod_session_key=w144dqljxlh096487nc33rm09vwtossh; prod_session_key=7mljy9k7niwpw4btbbyvuhkz7otbdh6v',
//     },
//   } );

//     if ( !response.ok ) throw new Error( `HTTP error! Status: ${response.status}` );

//     const dest = fs.createWriteStream( '2934.png' );
//     response.body.pipe( dest );

//     dest.on( 'finish', () => console.log( 'Image saved as image.jpg' ) );
//     dest.on( 'error', ( err ) => console.error( 'File write error:', err ) );
//   } catch ( err ) {
//     console.error( 'Fetch error:', err );
//   }
// }

// downloadImage();

export async function recorrectTaskData( req, res ) {
  if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
    return res.sendError( 'Unauthorized', 401 );
  }
  try {
    const taskData = await planoTaskService.find( { type: 'layout' } );

    for ( let index = 0; index < taskData.length; index++ ) {
      const task = taskData[index].toObject();

      console.log( { storeName: task.storeName, isPlano: true, date_string: task.date_string } );

      const processedTaskData = await processedTaskService.findOne( { storeName: task.storeName, isPlano: true, date_string: task.date_string } );

      const currentPlano = await planoService.findOne( { storeName: processedTaskData?.toObject().storeName } );

      const currentFloor = await storeBuilderService.findOne( { planoId: currentPlano?.toObject()._id } );

      const updateData = {
        storeName: currentPlano.toObject().storeName,
        planoId: currentPlano.toObject()._id,
        floorId: currentFloor.toObject()._id,
        taskId: processedTaskData?.toObject()?._id,
      };

      if ( task.date_string ) {
        updateData.date_iso = new Date( dayjs().format( task.date_string ) );
      }
      console.log( updateData );

      const updateTask = await planoTaskService.updateOne( { _id: task._id }, updateData );

      console.log( updateTask );
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    console.log( e );
    return res.sendError( e, 500 );
  }
}


export async function migrateCrestv1( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    const startTime = Date.now();

    const layoutApiUrl = 'https://api.getcrest.ai/api/ms_shelfsensei/layout/';
    let staticToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ1NTE3MjQxLCJpYXQiOjE3NDU1MTM2NDEsImp0aSI6Ijg3MWVlNTA3ODY2OTQ5OTVhMTQ0YTk4NzQyNzY0MzEzIiwidXNlcl9pZCI6MTA4NSwiaWQiOjEwODUsImlzX21lZXNlZWtfYWNjb3VudCI6ZmFsc2UsImN1c3RvbWVyX2dyb3VwIjozOTgsImxpY2VuY2Vfc2NvcGVzIjpbeyJyZXNvdXJjZV9zZXQiOiJwcF9zZXQiLCJzY29wZV9yb2xlIjoiY29udHJpYnV0b3IifSx7InJlc291cmNlX3NldCI6ImRwX3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9LHsicmVzb3VyY2Vfc2V0IjoiZGZfc2V0Iiwic2NvcGVfcm9sZSI6ImNvbnRyaWJ1dG9yIn0seyJyZXNvdXJjZV9zZXQiOiJkZWZhdWx0X3NldCIsInNjb3BlX3JvbGUiOiJjb250cmlidXRvciJ9XX0.eGzTMGwwstr13M0Hu1Ls5-gkE_oSPMJJBL2wgygT6Ac';
    const fetchWithCookies = fetchCookie( fetch );


    async function fetchStoreData( store, bearerToken, res ) {
      const payload = JSON.stringify( { store_id: store.toObject().storeName?.toUpperCase() } );

      try {
        const response = await fetch( layoutApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength( payload ),
          },
          body: payload,
        } );

        const data = await response.text();
        let jsonData = null;

        try {
          jsonData = JSON.parse( data );
        } catch ( parseError ) {
          logger.error( { functionName: `Warning: Received invalid JSON for store ${store.toObject().storeName}`, error: parseError } );
          console.warn( `Warning: Received invalid JSON for store ${store.toObject().storeName}` );
          return { storeName: store.toObject().storeName, data: null };
        }

        if ( jsonData.result === 'Token is invalid or expired' ) {
          console.log( 'Token expired, retrying...' );
          try {
            const newToken = await fetchNewToken();
            staticToken = newToken;
            return await fetchStoreData( store, newToken, res );
          } catch ( retryError ) {
            logger.error( { functionName: 'Failed to refresh token', error: retryError } );
            console.log( retryError );
            return res.sendError( 'Failed to refresh token', 401 );
          }
        }

        return { storeName: store.toObject().storeName, data: jsonData };
      } catch ( error ) {
        logger.error( { functionName: `Error fetching data for ${store.toObject().storeName}:`, error } );
        console.error( `Error fetching data for ${store.toObject().storeName}:`, error.message );
        return { storeName: store.toObject().storeName, data: null };
      }
    }


    const fetchNewToken = async () => {
      const email = 'tango.lenskart@getcrest.ai';
      const password = 'Tangolenskart@123';

      const credentials = JSON.stringify( { email, password } );

      const invalidateUrl = 'https://app.getcrest.ai/api/ms_iam/user/session/override/';
      const tokenUrl = 'https://app.getcrest.ai/api/ms_iam/token/';

      try {
        const invalidateRes = await fetchWithCookies( invalidateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: credentials,
        } );

        const invalidateData = await invalidateRes.json();
        console.log( 'Invalidate response:', invalidateData );

        console.log( 'Fetching new token...' );
        const tokenRes = await fetchWithCookies( tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
          },
          body: credentials,
        } );

        const tokenData = await tokenRes.json();
        console.log( 'Token response:', tokenData );

        return tokenData.access;
      } catch ( error ) {
        console.error( 'Error fetching new token:', error );
        throw error;
      }
    };

    const fetchVmImage = async ( attachmentId ) => {
      try {
        const response = await fetchWithCookies( `https://api.getcrest.ai/api/ms_data_preparation/master_data/attachment/?preview=0&attachment_id=${attachmentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${staticToken}`,
            'Cookie': 'prod_session_key=w144dqljxlh096487nc33rm09vwtossh',
          },
        } );


        if ( !response.ok ) {
          return;
          // throw new Error( `Failed to fetch image: ${response.status}` );
        }

        // const dest = fs.createWriteStream( `${attachmentId}.png` );
        // response.body.pipe( dest );

        return await response.buffer();
      } catch ( error ) {
        console.error( 'Error fetching image buffer:', error.message );
        throw error;
      }
    };

    const getImageMetadata = async ( imageBuffer ) => {
      try {
        const metadata = await sharp( imageBuffer ).metadata();
        const { width, height, format } = metadata;

        if ( !width || !height || !format ) throw new Error( 'Invalid image metadata' );

        const ratio = width / height;
        const normalizedRatio = ratio > 1 ? ratio : 1 / ratio;
        const squareThreshold = 1.2;
        const imageShape = normalizedRatio <= squareThreshold ? 'square' : 'rectangle';

        const fileExtension = format === 'jpeg' ? 'jpg' : format;
        const contentType = `image/${format}`;

        return {
          imageShape,
          width,
          height,
          fileExtension,
          contentType,
        };
      } catch ( error ) {
        console.error( 'Error processing image buffer:', error.message );
        throw error;
      }
    };


    if ( !req?.body?.storeName ) {
      return res.sendError( 'No store supplied', 200 );
    }

    let storeQuery = {
      clientId: '11',
      $and: [
        // { storeName: req.body.storeName },
        { storeName: { $in: [
          'LKST81',
          'LKST682',
          'LKST351',
          'LKST1193',
          'LKST98',
          'LKST01',
          'LKST266',
          'LKST495',
          'LKST2280',
          'LKST599',
          'LKST267',
        ] } },
        // { storeName: { $nin: [ 'LKST98', 'LKST1193' ] } },
      ],
    };

    let storeList = await storeService.find( storeQuery );

    // const constantFixtureLength = 1220;
    const constantDetailedFixtureLength = 1220;

    // const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;

    const mmToFeet = 305;

    function roundToTwo( num ) {
      return Math.round( num * 100 ) / 100;
    }


    for ( let i = 0; i < storeList.length; i++ ) {
      const storeData = await fetchStoreData( storeList[i], staticToken, res );

      if ( storeData?.data?.message !== 'SUCCESS' ) continue;


      const storeDetails = storeList[i];

      const existingPlanogram = await planoService.findOne( { storeName: storeData.storeName } );

      if ( existingPlanogram ) {
        const checkTaskSubmitted = await planoTaskService.findOne( { planoId: existingPlanogram.toObject()._id } );

        const checkTaskCreated = await processedTaskService.findOne( { storeName: storeData.storeName, date_string: dayjs().format( 'YYYY-MM-DD' ), isPlano: true } );

        if ( checkTaskSubmitted || checkTaskCreated ) {
          continue;
        }
      }


      if ( existingPlanogram?.toObject()?._id && mongoose.Types.ObjectId.isValid( existingPlanogram?.toObject()?._id ) ) {
        await Promise.all( [ planoService.deleteOne( { _id: existingPlanogram?.toObject()?._id } ), storeBuilderService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
          storeFixtureService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ), fixtureShelfService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
          planoMappingService.deleteMany( { planoId: existingPlanogram?.toObject()?._id } ),
        ] );
      }


      const planoInsertData = {
        storeName: storeData.storeName,
        storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
        layoutName: `${storeData.storeName} - Layout`,
        clientId: '11',
        attachments: [],
        createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
        createdByName: 'Bejan',
        createdByEmail: 'bejan@tangotech.co.in',
        status: 'completed',
        floorNumber: 1,
        productResolutionLevel: 'L2',
        scanType: 'qr',
      };

      const insertedPlano = await planoService.upsertOne( { storeName: storeData.storeName }, planoInsertData );
      const planoDoc = insertedPlano.toObject();

      const floors = new Set();

      for ( const item of storeData.data.result ) {
        if ( item.floor ) {
          floors.add( item.floor );
        }

        if ( Array.isArray( item.fixtures ) ) {
          for ( const fixture of item.fixtures ) {
            if ( fixture.floor ) {
              floors.add( fixture.floor );
            }
          }
        }
      }

      const floorArray = Array.from( floors );

      let isFloorKeyExist = true;

      if ( !floorArray.length ) {
        isFloorKeyExist = false;
        floorArray.push( 'GROUND' );
      }

      for ( let floorIndex = 0; floorIndex < floorArray.length; floorIndex++ ) {
        const leftWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'LEFT WALL' );
        let leftFixtures = leftWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          leftFixtures = leftFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        const rightWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT WALL' );
        let rightFixtures = rightWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          rightFixtures = rightFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        const backWall = storeData.data.result.filter( ( entry ) => entry['main'] === 'RIGHT VERTICAL WALL' );
        let backFixtures = backWall.flatMap( ( wall ) => wall.fixtures );
        if ( isFloorKeyExist ) {
          backFixtures = backFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }
        let floorFixtures = storeData.data.result.filter(
            ( entry ) => entry['main'] === 'Euro Center' || entry['main'] === 'Euro Center Dr',
        );
        if ( isFloorKeyExist ) {
          floorFixtures = floorFixtures.filter( ( fixture ) => fixture.floor === floorArray[floorIndex] );
        }

        // const leftXDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const leftXDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( leftFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        // const leftYDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantFixtureWidth / mmToFeet ) ) ) : 0;
        const leftYDetailedDistanceFeet = leftFixtures.length ? roundToTwo( ( ( constantDetailedFixtureWidth / mmToFeet ) ) ) : 0;

        // const rightXDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const rightXDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( rightFixtures.length * ( constantDetailedFixtureLength / mmToFeet ) ) ) : 0;

        // const rightYDistanceFeet = rightFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const rightYDetailedDistanceFeet = rightFixtures.length ? roundToTwo( ( constantDetailedFixtureWidth / mmToFeet ) ): 0;

        const maxFixturesPerRow = floorFixtures.length/2;
        const totalRows = 2;

        // const floorXDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantFixtureLength / mmToFeet ) ) ) : 0;
        const floorXDetailedDistanceFeet = floorFixtures.length ? roundToTwo( ( ( floorFixtures.length/2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) ): 0;

        // const floorYDistanceFeet = floorFixtures.length ? roundToTwo( ( 2 * ( constantFixtureWidth/ mmToFeet ) ) ): 0;
        const floorYDetailedDistanceFeet = floorFixtures.length ? roundToTwo( 2 * ( constantDetailedFixtureWidth/mmToFeet ) ): 0;

        // const backXDistanceFeet = backFixtures.length ? roundToTwo( ( constantFixtureWidth / mmToFeet ) ) : 0;
        const backXDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( constantDetailedFixtureLength / mmToFeet ) ) : 0;

        // const backYDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantFixtureLength / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantFixtureWidth )/mmToFeet ) ) ) : 0;
        const backYDetailedDistanceFeet = backFixtures.length ? roundToTwo( ( ( backFixtures.length * ( constantDetailedFixtureWidth / mmToFeet ) ) + ( ( ( leftFixtures.length ? 1 : 0 ) + ( rightFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth )/mmToFeet ) ) ): 0;

        // const maxXDistance = Math.max( leftXDistanceFeet, rightXDistanceFeet, floorXDistanceFeet );
        const maxXDetailedDistance = Math.max( leftXDetailedDistanceFeet, rightXDetailedDistanceFeet, floorXDetailedDistanceFeet );

        // const maxYDistance = Math.max( floorYDistanceFeet, backYDistanceFeet );
        const maxYDetailedDistance = Math.max( floorYDetailedDistanceFeet, backYDetailedDistanceFeet );

        // const finalXDistance = roundToTwo( ( maxXDistance < ( backXDistanceFeet + floorXDistanceFeet )? ( ( backXDistanceFeet + floorXDistanceFeet ) + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDistance + ( ( 2 * constantFixtureLength )/mmToFeet ) ) : maxXDistance ) );
        const finalXDetailedDistance = roundToTwo( ( maxXDetailedDistance < ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet )? ( ( backXDetailedDistanceFeet + floorXDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : ( floorFixtures.length && backFixtures.length ) ? ( maxXDetailedDistance + ( ( 2 * constantDetailedFixtureLength )/mmToFeet ) ) : maxXDetailedDistance ) );

        // const finalYDistance = roundToTwo( ( maxYDistance < ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) ? ( ( leftYDistanceFeet + rightYDistanceFeet + floorYDistanceFeet ) + ( ( 2 * constantFixtureWidth )/mmToFeet ) ) : ( maxYDistance + ( ( constantFixtureWidth )/mmToFeet ) ) ) );
        const finalYDetailedDistance = roundToTwo( ( maxYDetailedDistance < ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) ? ( ( leftYDetailedDistanceFeet + rightYDetailedDistanceFeet + floorYDetailedDistanceFeet ) + ( ( 2 * constantDetailedFixtureWidth )/mmToFeet ) ) : ( maxYDetailedDistance + ( ( constantDetailedFixtureWidth )/mmToFeet ) ) ) );


        const floorInsertData = {
          storeName: planoDoc.storeName,
          storeId: storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
          layoutName: `${planoDoc.storeName} - Layout`,
          clientId: '11',
          floorNumber: floorIndex + 1,
          floorName: `${floorArray[floorIndex].toLowerCase()} floor`,
          crestLayout: true,
          layoutPolygon: [
            {
              elementType: 'wall',
              distance: finalXDetailedDistance,
              unit: 'ft',
              direction: 'right',
              angle: 90,
              elementNumber: 1,
              // detailedDistance: finalXDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: finalYDetailedDistance,
              unit: 'ft',
              direction: 'down',
              angle: 90,
              elementNumber: 2,
              // detailedDistance: finalYDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: finalXDetailedDistance,
              unit: 'ft',
              direction: 'left',
              angle: 90,
              elementNumber: 3,
              // detailedDistance: finalXDetailedDistance,
            },
            {
              elementType: 'wall',
              distance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 4,
              // detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
            },
            {
              elementType: 'entrance',
              distance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 1,
              // detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 30 ) / 100 ) ),
            },
            {
              elementType: 'wall',
              distance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
              unit: 'ft',
              direction: 'up',
              angle: 90,
              elementNumber: 5,
              // detailedDistance: roundToTwo( ( ( finalYDetailedDistance * 35 ) / 100 ) ),
            },
          ],
          createdBy: new mongoose.Types.ObjectId( '66a78cd82734f4f857cd6db6' ),
          createdByName: 'Bejan',
          createdByEmail: 'bejan@tangotech.co.in',
          status: 'completed',
          planoId: planoDoc._id,
        };

        const layoutDoc = await storeBuilderService.upsertOne( { planoId: planoDoc._id, floorNumber: floorIndex + 1 }, floorInsertData );

        let fixtureCounter = 1;


        for ( let index = 0; index < leftFixtures.length; index++ ) {
          const fixture = leftFixtures[index];

          const fixtureConfig = await fixtureLibraryService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          let mapKey = `${fixtureConfigDoc.fixtureCategory}${fixtureConfigDoc.fixtureWidth.value}${fixtureConfigDoc.fixtureWidth.unit},${fixture.header}`;

          const fixtureProductSubBrandName = new Set();


          const shelfTemplate = fixtureConfigDoc.shelfConfig.map( ( configShelf, j ) => {
            const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
            const shelfSection = shelfZone?.products.find( ( product ) => !product.isMerchandisingElement );

            const shelfIdentifier = `shelf${j + 1}=${shelfSection?.productName}`;

            mapKey += ','+shelfIdentifier;

            const productSubBrandName = shelfSection?.productName?.replace( /\s*PIDs\b/g, '' )?.split( /\s*\+\s*/ ) || [];

            productSubBrandName.forEach( ( item ) => fixtureProductSubBrandName.add( item ) );

            return {
              shelfNumber: j+1,
              shelfType: configShelf?.shelfType,
              productPerShelf: configShelf?.productPerShelf,
              trayRows: configShelf?.trayRows,
              productBrandName: productSubBrandName,
              zone: configShelf.shelfZone,
            };
          } );

          [ ...fixtureProductSubBrandName ].forEach( async ( brand ) => {
            const upsertData = {
              clientId: '11',
              brandName: brand,
              brandDetails: [],
            };

            await planoProductCategoryService.upsertOne( { brandName: brand }, upsertData );
          } );

          const vmConfig = fixture.productZones?.flatMap( ( zone ) => {
            const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
            const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
            const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

            return vms.map( ( vm, k ) => {
              let configData = vmConfig[0];

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
              }

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
              }

              if ( configData.vmWidthmm === 905 ) {
                configData.zone = 'stretch';
              }

              if ( configData.vmWidthmm === 230 ) {
                configData.zone = 'left';
              }

              if ( !configData ) return;

              const vmIdentifier = `vm${k+1}=${vm.productName}+${configData.vmHeightmm}+${configData.vmWidthmm}+${configData.startShelf}+${configData.endShelf}+${configData.zone}`;

              mapKey += ','+vmIdentifier;

              return {
                startYPosition: configData.startShelf,
                endYPosition: configData.endShelf,
                xZone: configData.zone,
                vmName: vm.productName,
                vmHeight: configData.vmHeightmm,
                vmWidth: configData.vmWidthmm,
                imageUrl: zone?.actual_image_url,
              };
            } );
          } );

          const vmTemplate = await Promise.all( vmConfig.map( async ( vmTemplate ) => {
            const vmInsertData = {
              clientId: '11',
              vmName: vmTemplate.vmName,
              vmHeight: {
                value: vmTemplate.vmHeight,
                unit: 'mm',
              },
              vmWidth: {
                value: vmTemplate.vmWidth,
                unit: 'mm',
              },
              status: 'complete',
              vmBrand: vmTemplate.vmBrand,
              vmType: 'LKVM',

            };
            if ( vmTemplate?.imageUrl ) {
              const parsedUrl = new URL( vmTemplate.imageUrl );
              const attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

              const isVmImageExist = await planoVmService.findOne( { crestImageId: attachmentId } );

              if ( !isVmImageExist ) {
                const vmImageData = await fetchVmImage( attachmentId );

                const imageMeta = await getImageMetadata( vmImageData );

                const params = {
                  Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                  Key: `vmType/`,
                  fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                  ContentType: imageMeta.contentType,
                  body: vmImageData,
                };

                const imgUpload = await fileUpload( params );

                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = imgUpload.Key;


                if ( imageMeta.imageShape === 'square' ) {
                  vmInsertData.vmHeight.value = 100;
                  vmInsertData.vmWidth.value = 230;
                }
              } else {
                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = isVmImageExist.toObject().vmImageUrl;
              }
            }

            const vmDetails = await planoVmService.upsertOne(
                {
                  'productName': vmInsertData.vmName,
                },
                vmInsertData,
            );

            return {
              vmId: vmDetails.toObject()._id,
              startYPosition: vmTemplate.startYPosition,
              endYPosition: vmTemplate.endYPosition,
              xZone: vmTemplate.xZone,
              yZone: 'stretch',

            };
          } ) );

          const existingTemplateWithMaxIndex = await fixtureConfigService.sortAndFindOne(
              { fixtureCategory: fixtureConfigDoc.fixtureCategory,
                fixtureWidth: fixtureConfigDoc.fixtureWidth }, {}, { templateIndex: -1 } );

          let templateIndex = 1;

          if ( existingTemplateWithMaxIndex.length ) {
            const isTemplateSimilar = await fixtureConfigService.findOne( { crestMapKey: mapKey } );

            if ( isTemplateSimilar ) {
              templateIndex = isTemplateSimilar.toObject().templateIndex;
            } else {
              templateIndex = existingTemplateWithMaxIndex[0].toObject().templateIndex + 1;
            }
          }

          const templateName = `Template-${templateIndex}-${fixtureConfigDoc.fixtureCategory}`;


          const fixtureTemplateData = {
            ...fixtureConfigDoc,
            'shelfConfig': shelfTemplate,
            'vmConfig': vmTemplate,
            'clientId': fixtureConfigDoc.clientId,
            'fixtureName': templateName,
            'templateIndex': templateIndex,
            'header': {
              label: fixture.header ? fixture.header : fixture.fixtureSubname[0],
              isEnabled: true,
            },
            'footer': {
              label: fixture.footer,
              isEnabled: true,
            },
            'isBodyEnabled': true,
            'productResolutionLevel': 'L3',
            'productBrandName': [ ...fixtureProductSubBrandName ],
            'fixtureLibraryId': fixtureConfigDoc._id,
            'crestMapKey': mapKey,
          };

          delete fixtureTemplateData._id;


          const fixtureTemplate = await fixtureConfigService.upsertOne(
              { crestMapKey: mapKey },
              fixtureTemplateData,
          );

          const fixtureData = {
            ...fixtureTemplate.toObject(),
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'associatedElementType': 'wall',
            'associatedElementNumber': 1,
            'relativePosition': {
              'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
              'y': 0,
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            // 'relativeDetailedPosition': {
            //   'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            //   'y': 0,
            //   'unit': 'ft',
            // },
            'associatedElementFixtureNumber': index+1,
            'fixtureConfigId': fixtureTemplate.toObject()._id,
          };

          delete fixtureData._id;
          delete fixtureData.shelfConfig;

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          fixtureTemplate.shelfConfig.forEach( async ( configShelf, j ) => {
            const shelfData = {
              'clientId': '11',
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'fixtureId': createdFixture._id,
              'shelfNumber': j + 1,
              'shelfOrder': 'LTR',
              'shelfCapacity': configShelf.shelfCapacity,
              'productBrandName': configShelf.productBrandName,
              'shelfType': configShelf.shelfType,
              'productPerShelf': configShelf.productPerShelf,
              'trayRows': configShelf.trayRows,
              'productPerTray': configShelf.productPerTray,
              'zone': configShelf.zone,
            };

            await fixtureShelfService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  shelfNumber: j + 1,
                },
                shelfData,
            );
          } );
        }

        for ( let index = 0; index < backFixtures.length; index++ ) {
          const fixture = backFixtures[index];

          const fixtureConfig = await fixtureLibraryService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          let mapKey = `${fixtureConfigDoc.fixtureCategory}${fixtureConfigDoc.fixtureWidth.value}${fixtureConfigDoc.fixtureWidth.unit},${fixture.header}`;

          const fixtureProductSubBrandName = new Set();


          const shelfTemplate = fixtureConfigDoc.shelfConfig.map( ( configShelf, j ) => {
            const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
            const shelfSection = shelfZone?.products.find( ( product ) => !product.isMerchandisingElement );

            const shelfIdentifier = `shelf${j + 1}=${shelfSection?.productName}`;

            mapKey += ','+shelfIdentifier;

            const productSubBrandName = shelfSection?.productName?.replace( /\s*PIDs\b/g, '' )?.split( /\s*\+\s*/ ) || [];

            productSubBrandName.forEach( ( item ) => fixtureProductSubBrandName.add( item ) );

            return {
              shelfNumber: j+1,
              shelfType: configShelf?.shelfType,
              productPerShelf: configShelf?.productPerShelf,
              trayRows: configShelf?.trayRows,
              productBrandName: productSubBrandName,
              zone: configShelf.shelfZone,
            };
          } );

          [ ...fixtureProductSubBrandName ].forEach( async ( brand ) => {
            const upsertData = {
              clientId: '11',
              brandName: brand,
              brandDetails: [],
            };

            await planoProductCategoryService.upsertOne( { brandName: brand }, upsertData );
          } );

          const vmConfig = fixture.productZones?.flatMap( ( zone ) => {
            const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
            const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
            const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

            return vms.map( ( vm, k ) => {
              let configData = vmConfig[0];

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                configData.zone = 'stretch';
              }

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
              }

              if ( configData.vmWidthmm === 905 ) {
                configData.zone = 'stretch';
              }

              if ( configData.vmWidthmm === 230 ) {
                configData.zone = 'left';
              }

              if ( !configData ) return;

              const vmIdentifier = `vm${k+1}=${vm.productName}+${configData.vmHeightmm}+${configData.vmWidthmm}+${configData.startShelf}+${configData.endShelf}+${configData.zone}`;

              mapKey += ','+vmIdentifier;

              return {
                startYPosition: configData.startShelf,
                endYPosition: configData.endShelf,
                xZone: configData.zone,
                vmName: vm.productName,
                vmHeight: configData.vmHeightmm,
                vmWidth: configData.vmWidthmm,
                imageUrl: zone?.actual_image_url,
              };
            } );
          } );

          const vmTemplate = await Promise.all( vmConfig.map( async ( vmTemplate ) => {
            const vmInsertData = {
              clientId: '11',
              vmName: vmTemplate.vmName,
              vmHeight: {
                value: vmTemplate.vmHeight,
                unit: 'mm',
              },
              vmWidth: {
                value: vmTemplate.vmWidth,
                unit: 'mm',
              },
              status: 'complete',
              vmBrand: vmTemplate.vmBrand,
              vmType: 'LKVM',
            };
            if ( vmTemplate?.imageUrl ) {
              const parsedUrl = new URL( vmTemplate.imageUrl );
              const attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

              const isVmImageExist = await planoVmService.findOne( { crestImageId: attachmentId } );

              if ( !isVmImageExist ) {
                const vmImageData = await fetchVmImage( attachmentId );

                const imageMeta = await getImageMetadata( vmImageData );

                const params = {
                  Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                  Key: `vmType/`,
                  fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                  ContentType: imageMeta.contentType,
                  body: vmImageData,
                };

                const imgUpload = await fileUpload( params );


                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = imgUpload.Key;


                if ( imageMeta.imageShape === 'square' ) {
                  vmInsertData.vmHeight.value = 100;
                  vmInsertData.vmWidth.value = 230;
                }
              } else {
                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = isVmImageExist.toObject().vmImageUrl;
              }
            }

            const vmDetails = await planoVmService.upsertOne(
                {
                  'productName': vmInsertData.vmName,
                },
                vmInsertData,
            );

            return {
              vmId: vmDetails.toObject()._id,
              startYPosition: vmTemplate.startYPosition,
              endYPosition: vmTemplate.endYPosition,
              xZone: vmTemplate.xZone,
              yZone: 'stretch',
            };
          } ) );

          const existingTemplateWithMaxIndex = await fixtureConfigService.sortAndFindOne(
              { fixtureCategory: fixtureConfigDoc.fixtureCategory,
                fixtureWidth: fixtureConfigDoc.fixtureWidth }, {}, { templateIndex: -1 } );

          let templateIndex = 1;

          if ( existingTemplateWithMaxIndex.length ) {
            const isTemplateSimilar = await fixtureConfigService.findOne( { crestMapKey: mapKey } );

            if ( isTemplateSimilar ) {
              templateIndex = isTemplateSimilar.toObject().templateIndex;
            } else {
              templateIndex = existingTemplateWithMaxIndex[0].toObject().templateIndex + 1;
            }
          }


          const templateName = `Template-${templateIndex}-${fixtureConfigDoc.fixtureCategory}`;


          const fixtureTemplateData = {
            ...fixtureConfigDoc,
            'shelfConfig': shelfTemplate,
            'vmConfig': vmTemplate,
            'clientId': fixtureConfigDoc.clientId,
            'fixtureName': templateName,
            'templateIndex': templateIndex,
            'header': {
              label: fixture.header ? fixture.header : fixture.fixtureSubname[0],
              isEnabled: true,
            },
            'footer': {
              label: fixture.footer,
              isEnabled: true,
            },
            'isBodyEnabled': true,
            'productResolutionLevel': 'L3',
            'productBrandName': [ ...fixtureProductSubBrandName ],
            'fixtureLibraryId': fixtureConfigDoc._id,
            'crestMapKey': mapKey,
          };

          delete fixtureTemplateData._id;


          const fixtureTemplate = await fixtureConfigService.upsertOne(
              { crestMapKey: mapKey },
              fixtureTemplateData,
          );

          const fixtureData = {
            ...fixtureTemplate.toObject(),
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'associatedElementType': 'wall',
            'associatedElementNumber': 2,
            'relativePosition': {
              'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
              'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            // 'relativeDetailedPosition': {
            //   'x': roundToTwo( ( finalXDetailedDistance - ( constantDetailedFixtureLength/mmToFeet ) ) ),
            //   'y': roundToTwo( ( ( index * ( ( constantDetailedFixtureWidth/mmToFeet ) ) ) + ( ( leftFixtures.length ? 1 : 0 ) * constantDetailedFixtureWidth/mmToFeet ) ) ),
            //   'unit': 'ft',
            // },
            'associatedElementFixtureNumber': index+1,
            'fixtureConfigId': fixtureTemplate.toObject()._id,
          };

          delete fixtureData._id;
          delete fixtureData.shelfConfig;

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          fixtureTemplate.shelfConfig.forEach( async ( configShelf, j ) => {
            const shelfData = {
              'clientId': '11',
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'fixtureId': createdFixture._id,
              'shelfNumber': j + 1,
              'shelfOrder': 'LTR',
              'shelfCapacity': configShelf.shelfCapacity,
              'productBrandName': configShelf.productBrandName,
              'shelfType': configShelf.shelfType,
              'productPerShelf': configShelf.productPerShelf,
              'trayRows': configShelf.trayRows,
              'productPerTray': configShelf.productPerTray,
              'zone': configShelf.zone,
            };

            await fixtureShelfService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  shelfNumber: j + 1,
                },
                shelfData,
            );
          } );
        }

        for ( let index = 0; index < rightFixtures.length; index++ ) {
          const fixture = rightFixtures[index];

          const fixtureConfig = await fixtureLibraryService.findOne( { fixtureCategory: fixture.fixtureType } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          let mapKey = `${fixtureConfigDoc.fixtureCategory}${fixtureConfigDoc.fixtureWidth.value}${fixtureConfigDoc.fixtureWidth.unit},${fixture.header}`;

          const fixtureProductSubBrandName = new Set();


          const shelfTemplate = fixtureConfigDoc.shelfConfig.map( ( configShelf, j ) => {
            const shelfZone = fixture.productZones.find( ( zone ) => zone.zoneName === configShelf.shelfZone );
            const shelfSection = shelfZone?.products.find( ( product ) => !product.isMerchandisingElement );

            const shelfIdentifier = `shelf${j + 1}=${shelfSection?.productName}`;

            mapKey += ','+shelfIdentifier;

            const productSubBrandName = shelfSection?.productName?.replace( /\s*PIDs\b/g, '' )?.split( /\s*\+\s*/ ) || [];

            productSubBrandName.forEach( ( item ) => fixtureProductSubBrandName.add( item ) );

            return {
              shelfNumber: j+1,
              shelfType: configShelf?.shelfType,
              productPerShelf: configShelf?.productPerShelf,
              trayRows: configShelf?.trayRows,
              productBrandName: productSubBrandName,
              zone: configShelf.shelfZone,
            };
          } );

          [ ...fixtureProductSubBrandName ].forEach( async ( brand ) => {
            const upsertData = {
              clientId: '11',
              brandName: brand,
              brandDetails: [],
            };

            await planoProductCategoryService.upsertOne( { brandName: brand }, upsertData );
          } );


          const vmConfig = fixture.productZones?.flatMap( ( zone ) => {
            const vms = zone.products.filter( ( vm ) => vm.isMerchandisingElement );
            const vmConfig = fixtureConfigDoc.vmConfig.filter( ( vm ) => vm.position === zone.zoneName );
            const pids = zone.products.filter( ( vm ) => !vm.isMerchandisingElement );

            return vms.map( ( vm, k ) => {
              let configData = vmConfig[0];

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 905 );
                configData.zone = 'stretch';
              }

              if ( vm.productName === 'Creatr' && zone.zoneName === 'Mid' && pids.length ) {
                configData = vmConfig.find( ( config ) => config.vmWidthmm === 230 );
              }

              if ( configData.vmWidthmm === 905 ) {
                configData.zone = 'stretch';
              }

              if ( configData.vmWidthmm === 230 ) {
                configData.zone = 'left';
              }

              if ( !configData ) return;

              const vmIdentifier = `vm${k+1}=${vm.productName}+${configData.vmHeightmm}+${configData.vmWidthmm}+${configData.startShelf}+${configData.endShelf}+${configData.zone}`;

              mapKey += ','+vmIdentifier;

              return {
                startYPosition: configData.startShelf,
                endYPosition: configData.endShelf,
                xZone: configData.zone,
                vmName: vm.productName,
                vmHeight: configData.vmHeightmm,
                vmWidth: configData.vmWidthmm,
                imageUrl: zone?.actual_image_url,
              };
            } );
          } );

          const vmTemplate = await Promise.all( vmConfig.map( async ( vmTemplate ) => {
            const vmInsertData = {
              clientId: '11',
              vmName: vmTemplate.vmName,
              vmHeight: {
                value: vmTemplate.vmHeight,
                unit: 'mm',
              },
              vmWidth: {
                value: vmTemplate.vmWidth,
                unit: 'mm',
              },
              status: 'complete',
              vmBrand: vmTemplate.vmBrand,
              vmType: 'LKVM',
            };
            if ( vmTemplate?.imageUrl ) {
              const parsedUrl = new URL( vmTemplate.imageUrl );
              const attachmentId = parsedUrl.searchParams.get( 'attachment_id' );

              const isVmImageExist = await planoVmService.findOne( { crestImageId: attachmentId } );

              if ( !isVmImageExist ) {
                const vmImageData = await fetchVmImage( attachmentId );

                const imageMeta = await getImageMetadata( vmImageData );

                const params = {
                  Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
                  Key: `vmType/`,
                  fileName: `${attachmentId}.${imageMeta.fileExtension}`,
                  ContentType: imageMeta.contentType,
                  body: vmImageData,
                };

                const imgUpload = await fileUpload( params );

                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = imgUpload.Key;


                if ( imageMeta.imageShape === 'square' ) {
                  vmInsertData.vmHeight.value = 100;
                  vmInsertData.vmWidth.value = 230;
                }
              } else {
                vmInsertData.crestImageId = attachmentId;
                vmInsertData.vmImageUrl = isVmImageExist.toObject().vmImageUrl;
              }
            }

            const vmDetails = await planoVmService.upsertOne(
                {
                  'productName': vmInsertData.vmName,
                },
                vmInsertData,
            );

            return {
              vmId: vmDetails.toObject()._id,
              startYPosition: vmTemplate.startYPosition,
              endYPosition: vmTemplate.endYPosition,
              xZone: vmTemplate.xZone,
              yZone: 'stretch',
            };
          } ) );

          const existingTemplateWithMaxIndex = await fixtureConfigService.sortAndFindOne(
              { fixtureCategory: fixtureConfigDoc.fixtureCategory,
                fixtureWidth: fixtureConfigDoc.fixtureWidth }, {}, { templateIndex: -1 } );

          let templateIndex = 1;

          if ( existingTemplateWithMaxIndex.length ) {
            const isTemplateSimilar = await fixtureConfigService.findOne( { crestMapKey: mapKey } );

            if ( isTemplateSimilar ) {
              templateIndex = isTemplateSimilar.toObject().templateIndex;
            } else {
              templateIndex = existingTemplateWithMaxIndex[0].toObject().templateIndex + 1;
            }
          }


          const templateName = `Template-${templateIndex}-${fixtureConfigDoc.fixtureCategory}`;


          const fixtureTemplateData = {
            ...fixtureConfigDoc,
            'shelfConfig': shelfTemplate,
            'vmConfig': vmTemplate,
            'clientId': fixtureConfigDoc.clientId,
            'fixtureName': templateName,
            'templateIndex': templateIndex,
            'header': {
              label: fixture.header ? fixture.header : fixture.fixtureSubname[0],
              isEnabled: true,
            },
            'footer': {
              label: fixture.footer,
              isEnabled: true,
            },
            'isBodyEnabled': true,
            'productResolutionLevel': 'L3',
            'productBrandName': [ ...fixtureProductSubBrandName ],
            'fixtureLibraryId': fixtureConfigDoc._id,
            'crestMapKey': mapKey,
          };

          delete fixtureTemplateData._id;


          const fixtureTemplate = await fixtureConfigService.upsertOne(
              { crestMapKey: mapKey },
              fixtureTemplateData,
          );

          const fixtureData = {
            ...fixtureTemplate.toObject(),
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'associatedElementType': 'wall',
            'associatedElementNumber': 3,
            'relativePosition': {
              'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
              'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            // 'relativeDetailedPosition': {
            //   'x': roundToTwo( ( index * ( constantDetailedFixtureLength / mmToFeet ) ) ),
            //   'y': roundToTwo( ( finalYDetailedDistance - ( constantDetailedFixtureWidth / mmToFeet ) ) ),
            //   'unit': 'ft',
            // },
            'associatedElementFixtureNumber': index+1,
            'fixtureConfigId': fixtureTemplate.toObject()._id,
          };

          delete fixtureData._id;
          delete fixtureData.shelfConfig;

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          fixtureTemplate.shelfConfig.forEach( async ( configShelf, j ) => {
            const shelfData = {
              'clientId': '11',
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'fixtureId': createdFixture._id,
              'shelfNumber': j + 1,
              'shelfOrder': 'LTR',
              'shelfCapacity': configShelf.shelfCapacity,
              'productBrandName': configShelf.productBrandName,
              'shelfType': configShelf.shelfType,
              'productPerShelf': configShelf.productPerShelf,
              'trayRows': configShelf.trayRows,
              'productPerTray': configShelf.productPerTray,
              'zone': configShelf.zone,
            };

            await fixtureShelfService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  shelfNumber: j + 1,
                },
                shelfData,
            );
          } );
        }

        for ( let index = 0; index < floorFixtures.length; index++ ) {
          const fixture = floorFixtures[index];

          const centerRow = Math.floor( totalRows / 2 );

          // const startingX = roundToTwo( ( finalXDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) ) );
          const detailedStartingX = roundToTwo( ( finalXDetailedDistance / 2 - ( maxFixturesPerRow / 2 ) * ( constantDetailedFixtureLength / mmToFeet ) ) );

          // const startingY = finalYDistance / 2 - centerRow * ( constantFixtureWidth / mmToFeet );
          const detailedStartingY = finalYDetailedDistance / 2 - centerRow * ( constantDetailedFixtureWidth / mmToFeet );

          const colIndex = Math.floor( index / 2 );
          const rowIndex = index % 2 === 0 ? 1 : 0;

          // const xPos = roundToTwo( startingX + colIndex * ( constantFixtureLength / mmToFeet ) );
          // const yPos = roundToTwo( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) );

          const detailedXPos = roundToTwo( ( detailedStartingX + colIndex * ( constantDetailedFixtureLength / mmToFeet ) ) );
          const detailedYPos = roundToTwo( ( detailedStartingY + rowIndex * ( constantDetailedFixtureWidth / mmToFeet ) ) );

          const fixtureConfig = await fixtureLibraryService.findOne( { fixtureCategory: fixture.main } );
          if ( !fixtureConfig ) continue;
          const fixtureConfigDoc = fixtureConfig.toObject();

          let mapKey = `${fixtureConfigDoc.fixtureCategory}${fixtureConfigDoc.fixtureWidth.value}${fixtureConfigDoc.fixtureWidth.unit},${fixture.header}`;

          const fixtureProductSubBrandName = new Set();


          const shelfTemplate = fixtureConfigDoc.shelfConfig.map( ( configShelf, j ) => {
            const shelfSection = fixture?.centerSuperSubMain?.find( ( product ) => !product.isVisualMerchandiser );

            const shelfIdentifier = `shelf${j + 1}=${shelfSection?.productName}`;

            mapKey += ','+shelfIdentifier;


            let productSubBrandName = fixture.centerSubMain.replace( /\s*PIDs\b/g, '' )?.split( /\s*\+\s*/ ) || [];

            if ( shelfSection ) {
              productSubBrandName = shelfSection.name.replace( /\s*PIDs\b/g, '' )?.split( /\s*\+\s*/ ) || [];
            }

            productSubBrandName.forEach( ( item ) => fixtureProductSubBrandName.add( item ) );

            return {
              shelfNumber: j+1,
              shelfType: configShelf?.shelfType,
              productPerShelf: configShelf?.productPerShelf,
              trayRows: configShelf?.trayRows,
              productBrandName: productSubBrandName,
              zone: configShelf.shelfZone,
            };
          } );

          [ ...fixtureProductSubBrandName ].forEach( async ( brand ) => {
            const upsertData = {
              clientId: '11',
              brandName: brand,
              brandDetails: [],
            };

            await planoProductCategoryService.upsertOne( { brandName: brand }, upsertData );
          } );


          const vmConfig = fixture.centerSuperSubMain?.flatMap( ( vm ) => {
            if ( !vm?.isVisualMerchandiser ) {
              return [];
            }
            const vmConfig = fixtureConfigDoc.vmConfig;

            const [ configData1, configData2 ] = [ vmConfig[0], vmConfig[1] ];

            return [
              {
                startYPosition: configData1.startShelf,
                endYPosition: configData1.endShelf,
                xZone: 'left',
                vmName: vm.name + ' - 1',
                vmHeight: configData1.vmHeightmm,
                vmWidth: configData1.vmWidthmm,
              },
              {
                startYPosition: configData2.startShelf,
                endYPosition: configData2.endShelf,
                xZone: 'stretch',
                yZone: 'stretch',
                vmName: vm.name + ' - 2',
                vmHeight: configData2.vmHeightmm,
                vmWidth: configData2.vmWidthmm,
              },
            ];
          } );

          const vmTemplate = await Promise.all( vmConfig.map( async ( vmTemplate ) => {
            const vmInsertData = {
              clientId: '11',
              vmName: vmTemplate.vmName,
              vmHeight: {
                value: vmTemplate.vmHeight,
                unit: 'mm',
              },
              vmWidth: {
                value: vmTemplate.vmWidth,
                unit: 'mm',
              },
              status: 'complete',
              vmBrand: vmTemplate.vmBrand,
              vmType: 'LKVM',
            };

            const vmDetails = await planoVmService.upsertOne(
                {
                  'vmName': vmInsertData.vmName,
                },
                vmInsertData,
            );

            return {
              vmId: vmDetails.toObject()._id,
              startYPosition: vmTemplate.startYPosition,
              endYPosition: vmTemplate.endYPosition,
              xZone: vmTemplate.xZone,
              yZone: 'stretch',

            };
          } ) );

          const existingTemplateWithMaxIndex = await fixtureConfigService.sortAndFindOne(
              { fixtureCategory: fixtureConfigDoc.fixtureCategory,
                fixtureWidth: fixtureConfigDoc.fixtureWidth }, {}, { templateIndex: -1 } );

          let templateIndex = 1;

          if ( existingTemplateWithMaxIndex.length ) {
            const isTemplateSimilar = await fixtureConfigService.findOne( { crestMapKey: mapKey } );

            if ( isTemplateSimilar ) {
              templateIndex = isTemplateSimilar.toObject().templateIndex;
            } else {
              templateIndex = existingTemplateWithMaxIndex[0].toObject().templateIndex + 1;
            }
          }


          const templateName = `Template-${templateIndex}-${fixtureConfigDoc.fixtureCategory}`;


          const fixtureTemplateData = {
            ...fixtureConfigDoc,
            'shelfConfig': shelfTemplate,
            'vmConfig': vmTemplate,
            'clientId': fixtureConfigDoc.clientId,
            'fixtureName': templateName,
            'templateIndex': templateIndex,
            'header': {
              label: fixture.centerSubMain,
              isEnabled: true,
            },
            'footer': {
              label: 'Storage Box',
              isEnabled: true,
            },
            'isBodyEnabled': true,
            'productResolutionLevel': 'L3',
            'productBrandName': [ ...fixtureProductSubBrandName ],
            'fixtureLibraryId': fixtureConfigDoc._id,
            'crestMapKey': mapKey,
          };


          delete fixtureTemplateData._id;


          const fixtureTemplate = await fixtureConfigService.upsertOne(
              { crestMapKey: mapKey },
              fixtureTemplateData,
          );

          const fixtureData = {
            ...fixtureTemplate.toObject(),
            'storeName': layoutDoc.storeName,
            'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
            'planoId': layoutDoc.planoId,
            'floorId': layoutDoc._id,
            'relativePosition': {
              'x': detailedXPos,
              'y': detailedYPos,
              'unit': 'ft',
            },
            'fixtureNumber': fixtureCounter,
            // 'relativeDetailedPosition': {
            //   'x': detailedXPos,
            //   'y': detailedYPos,
            //   'unit': 'ft',
            // },
            'associatedElementFixtureNumber': index+1,
            'fixtureConfigId': fixtureTemplate.toObject()._id,
          };

          delete fixtureData._id;
          delete fixtureData.shelfConfig;

          const createdFixture = await storeFixtureService.upsertOne(
              {
                floorId: layoutDoc._id,
                fixtureNumber: fixtureCounter++,
              },
              fixtureData,
          );

          if ( !fixtureConfigDoc.shelfConfig.length || fixture.header === 'CL' || fixture.fixtureSubname?.includes( 'CL' ) ) continue;

          fixtureTemplate.shelfConfig.forEach( async ( configShelf, j ) => {
            const shelfData = {
              'clientId': '11',
              'storeName': layoutDoc.storeName,
              'storeId': storeDetails?.toObject()?.storeId ? storeDetails.toObject().storeId : 'nil',
              'planoId': layoutDoc.planoId,
              'floorId': layoutDoc._id,
              'fixtureId': createdFixture._id,
              'shelfNumber': j + 1,
              'shelfOrder': 'LTR',
              'shelfCapacity': configShelf.shelfCapacity,
              'productBrandName': configShelf.productBrandName,
              'shelfType': configShelf.shelfType,
              'productPerShelf': configShelf.productPerShelf,
              'trayRows': configShelf.trayRows,
              'productPerTray': configShelf.productPerTray,
              'zone': configShelf.zone,
            };

            await fixtureShelfService.upsertOne(
                {
                  fixtureId: createdFixture._id,
                  shelfNumber: j + 1,
                },
                shelfData,
            );
          } );
        }


        const now = Date.now();
        const elapsedMinutes = ( now - startTime ) / 1000 / 60;
        console.log( `Store name: ${storeData.storeName},Floor name: ${floorArray[floorIndex]} Iteration ${i + 1}/${storeList?.length}: total elapsed time = ${elapsedMinutes.toFixed( 2 )} minutes` );
        logger.info( { functionName: 'updateCrestPlanogram', body: `Store name: ${storeData.storeName},Floor name: ${floorArray[floorIndex]} Iteration ${i + 1}/${storeList?.length}: total elapsed time = ${elapsedMinutes.toFixed( 2 )} minutes` } );
      }
    }

    res.sendSuccess( 'Updated Successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateCrestPlanogram', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}
// function fillFeedbackFromJson( excelPath, jsonData, outputPath ) {
//   const workbook = xlsx.readFile( excelPath );
//   const sheetName = workbook.SheetNames[0];
//   const sheet = workbook.Sheets[sheetName];

//   const data = xlsx.utils.sheet_to_json( sheet, { defval: 'Transformed by Data.Page' } );

//   const feedbackMap = {};
//   jsonData.forEach( ( entry ) => {
//     feedbackMap[entry.store] = entry.videoUrl;
//   } );

//   const updatedData = data.map( ( row ) => {
//     const store = row.storeName;
//     if ( feedbackMap[store] ) {
//       row.FeedBack = feedbackMap[store];
//     }
//     return row;
//   } );

//   const newSheet = xlsx.utils.json_to_sheet( updatedData );

//   workbook.Sheets[sheetName] = newSheet;

//   xlsx.writeFile( workbook, outputPath );
// }

// fillFeedbackFromJson('input.xlsx', feedbackJson, 'output.xlsx');


// function exportFixtureJsonToExcel( fixtures, filePath ) {
//   const fixtureInfoArr = [];
//   const shelfConfigArr = [];
//   const vmConfigArr = [];

//   for ( const fixture of fixtures ) {
//     fixtureInfoArr.push( {
//       clientId: fixture.clientId,
//       fixtureCode: fixture.fixtureCode,
//       fixtureCategory: fixture.fixtureCategory,
//       fixtureConfigType: fixture.fixtureConfigType,
//       fixtureLength: `${fixture.fixtureLength?.value} ${fixture.fixtureLength?.unit}`,
//       fixtureCapacity: fixture.fixtureCapacity,
//     } );

//     ( fixture.shelfConfig || [] ).forEach( ( shelf ) => {
//       shelfConfigArr.push( {
//         fixtureCode: fixture.fixtureCode,
//         ...shelf,
//       } );
//     } );

//     ( fixture.vmConfig || [] ).forEach( ( vm ) => {
//       vmConfigArr.push( {
//         fixtureCode: fixture.fixtureCode,
//         ...vm,
//       } );
//     } );
//   }

//   const workbook = xlsx.utils.book_new();
//   xlsx.utils.book_append_sheet( workbook, xlsx.utils.json_to_sheet( fixtureInfoArr ), 'Fixture Info' );
//   xlsx.utils.book_append_sheet( workbook, xlsx.utils.json_to_sheet( shelfConfigArr ), 'Shelf Config' );
//   xlsx.utils.book_append_sheet( workbook, xlsx.utils.json_to_sheet( vmConfigArr ), 'VM Config' );

//   xlsx.writeFile( workbook, filePath );
// }

// const fixtures = JSON.parse( fs.readFileSync( './input.json', 'utf-8' ) );
// exportFixtureJsonToExcel( fixtures, 'output.xlsx' );


