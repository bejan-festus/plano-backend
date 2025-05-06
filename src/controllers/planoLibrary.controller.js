import { logger } from 'tango-app-api-middleware';
import * as planoLibraryService from '../service/planoLibrary.service.js';
// import * as fixtureService from '../service/storeFixture.service.js';
// import * as planoService from '../service/planogram.service.js';
import * as fixtureTemplateService from '../service/fixtureConfig.service.js';
import xlsx from 'xlsx';


export async function fixtureBulkUpload( req, res ) {
  try {
    if ( !req?.files?.file ) {
      return res.sendError( 'Please upload a file', 400 );
    }
    const workbook = xlsx.read( req?.files?.file?.data, { type: 'buffer' } );
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json( worksheet );
    let fixtureData = [];
    let FixLibCode = await getMaxFixtureLibCode();
    data.forEach( async ( ele ) => {
      let fixtureEle = {
        clientId: req.body.clientId,
        fixtureCategory: ele['Fixture Name'],
        fixtureType: ele['Fixture Type'],
        fixtureHeight: {
          value: ele['Height(ft)'],
          unit: 'ft',
        },
        fixtureWidth: {
          value: ele['width(ft)'],
          unit: 'ft',
        },
        shelfConfig: [],
        ...( ele.fixtureLibCode ) ? { fixtureLibCode: FixLibCode } : {},
      };
      for ( let i=1; i<=ele['Shelf Count']; i++ ) {
        let shelfType = `Shelf${i} Type`;
        let TrayRow = `Tray${i} Row`;
        let shelfProducts = `Shelf${i} Product Capacity`;
        fixtureEle.shelfConfig.push( {
          shelfType: ele[shelfType].toLowerCase(),
          shelfNumber: i,
          productPerShelf: ele[shelfType] == 'Shelf' ? ele[shelfProducts] : ele[TrayRow]*ele[shelfProducts],
          trayRows: ele[shelfType] == 'Shelf' ? 0 : ele[TrayRow],
          productPerTray: ele[shelfType] == 'Tray' ? ele[shelfProducts] : 0,
        } );
      }
      if ( ele?.fixtureLibCode ) {
        await planoLibraryService.updateOne( { fixtureLibCode: ele.fixtureLibCode }, fixtureEle );
      } else {
        fixtureData.push( fixtureEle );
      }
    } );
    await planoLibraryService.insertMany( fixtureData );
    return res.sendSuccess( 'FIxture library created successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'fixtureBulkUpload', error: e } );
    return res.sendError( e, 500 );
  }
}

async function getMaxFixtureLibCode() {
  try {
    let getFixtureLibDetails = await planoLibraryService.find( {}, { fixtureLibCode: 1 } );
    if ( !getFixtureLibDetails.length ) {
      return 'FX01';
    } else {
      let numList = getFixtureLibDetails.map( ( ele ) => ele.fixtureLibCode.substring( 2 ) );
      let missingNum = [];
      for ( let i=1; i<=getFixtureLibDetails.length; i++ ) {
        let numPad = String( i ).padStart( 2, '0' );
        if ( !numList.includes( numPad ) ) {
          missingNum.push( numPad );
        }
      }
      if ( missingNum.length ) {
        return 'FX'+ missingNum[0];
      } else {
        return 'FX'+ String( parseInt( getFixtureLibDetails.length+1 ) ).padStart( 2, '0' );
      }
    }
  } catch ( e ) {
    logger.error( { functionName: 'getMaxFixtureLibCode', error: e } );
    return false;
  }
}

export async function createFixture( req, res ) {
  try {
    let FixLibCode = await getMaxFixtureLibCode();
    let data ={
      clientId: req.body.clientId,
      fixtureCategory: req.body.fixtureName,
      fixtureType: req.body.fixtureType,
      fixtureLibCode: FixLibCode,
    };
    let fixtLibraryDetails = await planoLibraryService.create( data );
    return res.sendSuccess( { message: 'Fixture library created successfully', data: fixtLibraryDetails } );
  } catch ( e ) {
    logger.error( { functionName: 'createFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateFixture( req, res ) {
  try {
    let fixtureLibraryDetails = await planoLibraryService.findOne( { _id: req.params.fixtureId } );
    if ( !fixtureLibraryDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    if ( fixtureLibraryDetails.fixtureType == 'floor' ) {
      req.body.panelConfig = req.body.panelConfig.map( ( ele ) => {
        ele = { ...ele, productPerPanel: ele.panelRow * ele.productPerPanelRow };
        return ele;
      } );
    }

    let fixtureData = {
      ...( req.body.fixtureHeight ) ? {
        fixtureHeight: {
          value: req.body.fixtureHeight,
          unit: 'ft',
        },
      } : {},
      ...( req.body.fixtureLength ) ? {
        fixtureLength: {
          value: req.body.fixtureLength,
          unit: 'ft',
        },
      } : {},
      ...( req.body.fixtureWidth ) ? {
        fixtureWidth: {
          value: req.body.fixtureWidth,
          unit: 'ft',
        },
      } : {},
      ...( fixtureLibraryDetails.fixtureType == 'wall' ) ? {
        shelfConfig: req.body.shelfConfig,
      } : { panelConfig: req.body.panelConfig },
      status: req.body.status,
      updatedAt: new Date(),
    };
    await planoLibraryService.updateOne( { _id: req.params.fixtureId }, fixtureData );
    return res.sendSuccess( 'Fixture library details updates successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'updateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getFixture( req, res ) {
  try {
    if ( !req.params?.fixtureId ) {
      return res.sendError( 'FixtureId is required', 400 );
    }
    let fixtureLibDetails = await planoLibraryService.findOne( { _id: req.params?.fixtureId } );
    if ( !fixtureLibDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    return res.sendSuccess( fixtureLibDetails );
  } catch ( e ) {
    logger.error( { functionName: 'updateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function FixtureLibraryList( req, res ) {
  try {
    let limit = req.body?.limit || 10;
    let page = req.body?.offset || 0;
    let skip = limit * page;

    const matchStage = {
      clientId: req.body.clientId,
      ...( req.body?.searchValue ?
    { fixtureCategory: { $regex: req.body.searchValue, $options: 'i' } } :
    {} ),
      ...( req.body?.filter?.type?.length ?
    { fixtureType: { $in: req.body.filter.type } } :
    {} ),
      ...( req.body?.filter?.size?.length ?
    { 'fixtureWidth.value': { $in: req.body.filter.size } } :
    {} ),
    };

    const query = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'storefixtures',
          let: { libraryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [ '$fixtureLibraryId', '$$libraryId' ],
                },
              },
            },
            {
              $group: {
                _id: null,
                planoId: { $push: '$planoId' },
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
          fixtureWidth: 1,
          fixtureHeight: 1,
          fixtureLength: 1,
          shelfConfig: 1,
          fixtureCategory: 1,
          clientId: 1,
          fixtureType: 1,
          status: 1,
          planoId: { $arrayElemAt: [ '$storeFixtureDetails.planoId', 0 ] },
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
                statusList: { $push: '$status' },
              },
            },
          ],
          as: 'planoStatus',
        },
      },

      {
        $project: {
          fixtureWidth: 1,
          fixtureHeight: 1,
          fixtureLength: 1,
          fixtureType: 1,
          shelfConfig: 1,
          fixtureCategory: 1,
          clientId: 1,
          status: {
            $cond: {
              if: { $in: [ 'completed', { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] } ] },
              then: 'active',
              else: {
                $cond: {
                  if: {
                    $gt: [
                      { $size: { $ifNull: [ '$planoId', [] ] } },
                      0,
                    ],
                  },
                  then: 'inactive',
                  else: '$status',
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
    }
    query.push(
        {
          $facet: {
            fixtureData: [ { $skip: skip }, { $limit: limit } ],
            count: [ { $count: 'total' } ],
          },
        },
    );
    console.log( JSON.stringify( query ) );
    let fixtureDetails = await planoLibraryService.aggregate( query );
    if ( !fixtureDetails[0]?.fixtureData.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      count: fixtureDetails[0].count[0].total,
      data: fixtureDetails[0].fixtureData,
    };
    return res.sendSuccess( result );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'updateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function duplicateFixture( req, res ) {
  try {
    if ( !req.body?.fixtureId ) {
      return res.sendError( 'FixtureId is required', 400 );
    }
    let fixtureLibDetails = await planoLibraryService.findOne( { _id: req.body?.fixtureId } );
    if ( !fixtureLibDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    fixtureLibDetails = fixtureLibDetails.toObject();
    delete fixtureLibDetails._id;
    await planoLibraryService.create( fixtureLibDetails );
    return res.sendSuccess( 'Fixture duplicated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'duplicateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deleteFixture( req, res ) {
  try {
    if ( !req.body?.fixtureId ) {
      return res.sendError( 'FixtureId is required', 400 );
    }
    let fixtureLibDetails = await planoLibraryService.findOne( { _id: req.body?.fixtureId } );
    if ( !fixtureLibDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let fixtureTemplate = await fixtureTemplateService.count( { fixtureLibraryId: req.body?.fixtureId } );
    if ( fixtureTemplate ) {
      return res.sendError( `Fixture is mapped with ${fixtureTemplate} templates`, 400 );
    }
    await planoLibraryService.deleteOne( { _id: req.body?.fixtureId } );
    return res.sendSuccess( 'Fixture deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteFixture', error: e } );
    return res.sendError( e, 500 );
  }
}
