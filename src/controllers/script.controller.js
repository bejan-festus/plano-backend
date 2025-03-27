// import { writeFileSync } from 'fs';
import xlsx from 'xlsx';
import { logger } from 'tango-app-api-middleware';
import * as storeBuilderService from '../service/storeBuilder.service.js';
import * as storeService from '../service/store.service.js';
import * as planoService from '../service/planogram.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as fixtureShelfService from '../service/fixtureShelf.service.js';
import * as planoProductService from '../service/planoProduct.service.js';
import * as planoMappingService from '../service/planoMapping.service.js';
import * as planoTaskService from '../service/planoTask.service.js';
// import * as planoComplianceService from '../service/planoCompliance.service.js';
// import * as planoTaskComplianceService from '../service/planoTask.service.js';
// import * as planoQrConversionRequestService from '../service/planoQrConversionRequest.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import mongoose from 'mongoose';
import JSZip from 'jszip';


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

        // console.log( 'Fixture Data', fixtureData );


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

        // console.log( 'Fixture Data', fixtureData );

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

              // console.log( 'Shelf Data:', createdShelf );

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

        // console.log( 'Fixture Data', fixtureData );

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
        // console.log( 'Fixture Data', fixtureData );

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

export async function updatelayoutFeedback( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }
    const layoutFeedbacks = await planoTaskService.find( { type: 'layout' } );

    for ( let i = 0; i < layoutFeedbacks.length; i++ ) {
      const layoutDoc = layoutFeedbacks[i].toObject();

      const [ q1, q2, q3 ] = layoutDoc.answers;

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

export async function updateFixtureFeedback( req, res ) {
  try {
    if ( req?.headers?.authorization?.split( ' ' )[1] !== 'hwjXfCD6TgMvc82cuSGZ9bNv9MuXsaiQ6uvx' ) {
      return res.sendError( 'Unauthorized', 401 );
    }

    
  } catch ( e ) {
    logger.error( { functionName: 'updatelayoutFeedback', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}
