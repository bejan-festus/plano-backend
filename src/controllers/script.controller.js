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
// import * as planoComplianceService from '../service/planoCompliance.service.js';
// import * as planoTaskComplianceService from '../service/planoTask.service.js';
// import * as planoQrConversionRequestService from '../service/planoQrConversionRequest.service.js';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import mongoose from 'mongoose';


export async function getStoreNames( req, res ) {
  try {
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

      await planoService.create( planoInsertData );

      console.log( planoInsertData );
    }

    return res.sendSuccess( { message: 'Plano data inserted successfully', length: storeNamesArray.length } );
  } catch ( e ) {
    logger.error( { functionName: 'createPlanoAPI', error: e } );
    return res.sendError( e.message || 'Internal Server Error', 500 );
  }
}

export async function createFloors( req, res ) {
  try {
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

    await Promise.all( storeList.map( async ( store ) => {
      const planoDoc = store.toObject();
      const leftWalls = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Left' );
      const leftWallCount = leftWalls.length;

      const totalLeftDistanceFeet = Math.round( ( leftWallCount * ( constantFixtureLength / mmToFeet ) ) );
      const totalLeftDetailedDistanceFeet = Math.round( ( leftWallCount * ( constantDetailedFixtureLength / mmToFeet ) ) );

      const rightWalls = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Right' );
      const rightWallCount = rightWalls.length;

      const totalRightDistanceFeet = Math.round( ( rightWallCount * ( constantFixtureLength / mmToFeet ) ) );
      const totalRightDetailedDistanceFeet = Math.round( ( rightWallCount * ( constantDetailedFixtureLength / mmToFeet ) ) );

      const totalDistanceFeet = Math.max( totalLeftDistanceFeet, totalRightDistanceFeet );
      const totalDetailedDistanceFeet = Math.max( totalLeftDetailedDistanceFeet, totalRightDetailedDistanceFeet );

      const floorFixtures = raw.filter( ( entry ) => entry['Store ID'] === planoDoc.storeName && entry.Wall === 'Centre' );
      const floorFixtureLength = floorFixtures.length;
      const maxFixturesPerRow = floorFixtureLength > 4 ? 3 : 2;
      const totalRows = Math.ceil( floorFixtureLength / maxFixturesPerRow );

      const yDistance = Math.round( ( ( totalRows + 6 ) * ( constantFixtureWidth / mmToFeet ) ) );
      const detailedyDistance = Math.round( ( ( totalRows + 4 ) * ( constantDetailedFixtureWidth / mmToFeet ) ) );

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
            distance: totalDistanceFeet + 3,
            unit: 'ft',
            direction: 'right',
            angle: 90,
            elementNumber: 1,
            detailedDistance: totalDetailedDistanceFeet + 3,
          },
          {
            elementType: 'wall',
            distance: yDistance,
            unit: 'ft',
            direction: 'down',
            angle: 90,
            elementNumber: 2,
            detailedDistance: detailedyDistance,
          },
          {
            elementType: 'wall',
            distance: totalDistanceFeet + 3,
            unit: 'ft',
            direction: 'left',
            angle: 90,
            elementNumber: 3,
            detailedDistance: totalDetailedDistanceFeet + 3,
          },
          {
            elementType: 'wall',
            distance: Math.round( ( yDistance * 40 ) / 100 ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 4,
            detailedDistance: Math.round( ( detailedyDistance * 35 ) / 100 ),
          },
          {
            elementType: 'entrance',
            distance: Math.round( ( yDistance * 20 ) / 100 ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 1,
            detailedDistance: Math.round( ( detailedyDistance * 30 ) / 100 ),
          },
          {
            elementType: 'wall',
            distance: Math.round( ( yDistance * 40 ) / 100 ),
            unit: 'ft',
            direction: 'up',
            angle: 90,
            elementNumber: 5,
            detailedDistance: Math.round( ( detailedyDistance * 35 ) / 100 ),
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
    const constantDetailedFloorFixtureLength = 1524;


    const constantFixtureWidth = 610;
    const constantDetailedFixtureWidth = 1524;
    const constantDetailedFloorFixtureWidth = 1220;


    const mmToFeet = 305;
    const layoutList = await storeBuilderService.find( {} );

    for ( let i = 0; i < layoutList.length; i++ ) {
      const layout = layoutList[i];

      const layoutDoc = layout.toObject();

      const leftFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Left' );
      const leftWallCount = leftFixtures.length;

      const rightFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Right' );
      const rightWallCount = rightFixtures.length;


      const floorFixtures = raw.filter( ( entry ) => entry['Store ID'] === layoutDoc.storeName && entry.Wall === 'Centre' );
      const floorFixtureCount = floorFixtures.length;

      const maxFixturesPerRow = floorFixtureCount > 4 ? 3 : 2;

      const totalRows = Math.ceil( floorFixtureCount / maxFixturesPerRow );
      const centerRow = Math.floor( totalRows / 2 );

      const totalLeftDistanceFeet = Math.round( ( leftWallCount * ( constantFixtureLength/mmToFeet ) ) );
      const totalLeftDetailedDistanceFeet = Math.round( ( leftWallCount * ( constantDetailedFixtureLength/mmToFeet ) ) );

      const totalRightDistanceFeet = Math.round( ( rightWallCount * ( constantFixtureLength/mmToFeet ) ) );
      const totalRightDetailedDistanceFeet = Math.round( ( rightWallCount * ( constantDetailedFixtureLength/mmToFeet ) ) );

      const totalCentreDistanceFeet = Math.round( ( ( totalRows + 6 ) * ( constantFixtureWidth/mmToFeet ) ) );
      const totalCentreDetailedDistanceFeet = Math.round( ( ( totalRows + 4 ) * ( constantDetailedFixtureWidth/mmToFeet ) ) );

      const totalDistanceFeetX = Math.max( totalLeftDistanceFeet, totalRightDistanceFeet );
      const totalDetailedDistanceFeetX = Math.max( totalLeftDetailedDistanceFeet, totalRightDetailedDistanceFeet );

      const totalDistanceFeetY = totalCentreDistanceFeet;
      const totalDetailedDistanceFeetY = totalCentreDetailedDistanceFeet;

      const startingX = ( totalDistanceFeetX / 2 ) - ( Math.floor( maxFixturesPerRow / 2 ) * ( constantFixtureLength / mmToFeet ) );
      const startingY = ( totalDistanceFeetY / 2 ) - ( centerRow * ( constantFixtureWidth / mmToFeet ) );

      const detailedStartingX = ( totalDetailedDistanceFeetX / 2 ) - ( Math.floor( maxFixturesPerRow / 2 ) * ( constantDetailedFloorFixtureLength / mmToFeet ) );
      const detailedStartingY = ( totalDetailedDistanceFeetY / 2 ) - ( centerRow * ( constantDetailedFloorFixtureWidth / mmToFeet ) );

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
            'x': Math.round( ( index * ( constantFixtureLength/mmToFeet ) ) ),
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
            'x': Math.round( ( index * ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': 0,
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );

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
            'x': Math.round( ( index * ( constantFixtureLength/mmToFeet ) ) ),
            'y': Math.round( ( ( ( totalRows + 6 ) * ( constantFixtureWidth/mmToFeet ) ) - ( constantFixtureWidth/mmToFeet ) ) ),
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
            'x': Math.round( ( index * ( constantDetailedFixtureLength/mmToFeet ) ) ),
            'y': Math.round( ( ( ( totalRows + 4 ) * ( constantDetailedFixtureWidth/mmToFeet ) ) - ( constantDetailedFixtureWidth/mmToFeet ) ) ),
            'unit': 'ft',
          },
          'productResolutionLevel': 'L2',
        };

        const createdFixture = await storeFixtureService.create( fixtureData );

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

        const rowIndex = Math.floor( index / maxFixturesPerRow );
        const colIndex = index % maxFixturesPerRow;

        const xPos = Math.round( startingX + colIndex * ( constantFixtureLength / mmToFeet ) );
        const yPos = Math.round( startingY + rowIndex * ( constantFixtureWidth / mmToFeet ) );

        const detailedXPos = Math.round( detailedStartingX + colIndex * ( constantDetailedFloorFixtureLength / mmToFeet ) );
        const detailedYPos = Math.round( detailedStartingY + rowIndex * ( constantDetailedFloorFixtureWidth / mmToFeet ) );

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
            'value': constantDetailedFloorFixtureLength,
            'unit': 'mm',
          },
          'detailedFixtureWidth': {
            'value': constantDetailedFloorFixtureWidth,
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
