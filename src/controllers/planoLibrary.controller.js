import { logger } from 'tango-app-api-middleware';
import * as planoLibraryService from '../service/planoLibrary.service.js';
import * as fixtureTemplateService from '../service/fixtureConfig.service.js';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
const ObjectId = mongoose.Types.ObjectId;

export async function fixtureBulkUpload( req, res ) {
  try {
    let inputData = req.body;
    let groupedData = inputData.fixtureData.reduce( ( acc, ele ) => {
      let element = ele.fixtureName +'-'+ele.width;
      if ( !acc[element] ) {
        acc[element] = {
          'clientId': inputData.clientId,
          'fixtureCategory': ele.fixtureName,
          'fixtureType': ele.fixtureType,
          'fixtureLength': {
            value: ele.height,
            unit: 'ft',
          },
          'fixtureWidth': {
            value: ele.width,
            unit: 'ft',
          },
          'fixtureLibCode': ele?.FixLibCode || '',
          'header.height': {
            value: ele.headerHeight,
            unit: 'ft',
          },
          'footer.height': {
            value: ele.footerHeight,
            unit: 'ft',
          },
          'shelfConfig': [
            {
              shelfNumber: ele.shelfNumber,
              shelfType: ele.shelfType,
              trayRow: ele.shelfType =='shelf' ? 0 : ele.trayRows,
              productPerShelf: ele.productPerShelf,
              label: ele.shelfName,
            },
          ],
          'status': ele?.FixLibCode ? inputData.updateFixtureStatus : inputData.newFixtureStatus,
        };
      } else {
        acc[element].shelfConfig.push(
            {
              shelfNumber: ele.shelfNumber,
              shelfType: ele.shelfType,
              trayRow: ele.trayRows,
              productPerShelf: ele.productPerShelf,
              label: ele.shelfName,
            },
        );
      }
      return acc;
    }, {} );
    let fixtureData = [];
    await Promise.all( Object.keys( groupedData ).map( async ( ele ) => {
      if ( groupedData[ele]?.fixtureLibCode ) {
        await planoLibraryService.updateOne( { fixtureLibCode: ele.fixtureLibCode }, fixtureEle );
      } else {
        let FixLibCode = await getMaxFixtureLibCode();
        groupedData[ele].fixtureLibCode = FixLibCode;
        fixtureData.push( groupedData[ele] );
      }
    } ) );
    let deleteList = inputData.deleteFixtureList.map( ( ele ) => new ObjectId( ele ) );
    if ( deleteList.length ) {
      await planoLibraryService.deleteMany( { _id: { $in: deleteList } } );
    }
    await planoLibraryService.insertMany( fixtureData );
    return res.sendSuccess( 'Fixture library created successfully' );
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
    console.log( e );
    logger.error( { functionName: 'getMaxFixtureLibCode', error: e } );
    return false;
  }
}

export async function createFixture( req, res ) {
  try {
    let FixLibCode = await getMaxFixtureLibCode();
    let data ={
      clientId: req.body.clientId,
      fixtureCategory: req.body.fixtureCategory,
      fixtureType: req.body.fixtureType,
      fixtureLibCode: FixLibCode,
    };
    let fixtLibraryDetails = await planoLibraryService.create( data );
    return res.sendSuccess( fixtLibraryDetails );
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

    let fixtureData = {
      ...req.body,
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
          from: 'fixtureconfigs',
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
                templateId: { $push: '$_id' },
              },
            },
            {
              $project: {
                _id: 0,
                templateId: 1,
              },
            },
          ],
          as: 'fixtureTemplate',
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
          header: 1,
          footer: 1,
          fixtureLibCode: 1,
          templateId: { $ifNull: [ { $arrayElemAt: [ '$fixtureTemplate.templateId', 0 ] }, [] ] },
        },
      },
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
          templateId: 1,
          header: 1,
          footer: 1,
          fixtureLibCode: 1,
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
          planoId: 1,
          templateId: 1,
          header: 1,
          footer: 1,
          fixtureLibCode: 1,
          planoStatus: { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] },
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
    let fixtureDetails = await planoLibraryService.aggregate( query );
    if ( !fixtureDetails[0]?.fixtureData.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      count: fixtureDetails[0].count[0].total,
      data: fixtureDetails[0].fixtureData,
    };
    if ( !req.body.export ) {
      return res.sendSuccess( result );
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet( 'Fixture Library' );

      sheet.getRow( 1 ).values = [ 'Fixture Code', 'Fixture Name', 'Fixture Type', 'Fixture Height(ft)', 'Fixture Width(ft)', 'Fixture Header height(ft)', 'Fixture Footer Height(ft)', 'Shelf Number', 'Shelf Type', 'Tray Rows', 'Product Per Shelf/Tray', 'Shelf Name' ];

      let rowStart = 2;
      let lockedRowNumber = [];

      if ( req.body.emptyDownload ) {
        result.data = [];
      }
      for ( let i=0; i<result.data.length; i++ ) {
        let height = 0;
        let width = 0;
        let headerHeight = 0;
        let footerHeight = 0;
        if ( result.data[i]?.fixtureHeight ) {
          height = result.data[i].fixtureHeight.value;
        }
        if ( result.data[i]?.fixtureWidth ) {
          width = result.data[i].fixtureWidth.value;
        }
        if ( result.data[i]?.header?.height?.value ) {
          headerHeight = result.data[i].header.height.value;
        }
        if ( result.data[i]?.footer?.height?.value ) {
          footerHeight = result.data[i].footer.height.value;
        }
        if ( !result.data[i].shelfConfig.length ) {
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureLibCode || '', result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, 0, 'Shlef', 0, 0, '' ];
          if ( result.data[i].status == 'active' || result.data[i].templateId.length ) {
            lockedRowNumber.push( rowStart );
          }
          rowStart = rowStart + 1;
        }

        result.data[i].shelfConfig.forEach( ( shelf ) => {
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureLibCode || '', result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, shelf?.shelfNumber || 0, shelf?.shelfType || 'Shelf', shelf?.trayRows || 0, shelf?.productPerShelf || 0, shelf?.label || '' ];
          if ( result.data[i].status == 'active' || result.data[i].templateId.length ) {
            lockedRowNumber.push( rowStart );
          }
          rowStart = rowStart + 1;
        } );
      }


      const maxRows = 1048576;

      let unlockCellValues = 20000;
      let splitLoop = [];

      for ( let i=1; i<=unlockCellValues; i+=2000 ) {
        splitLoop.push( { start: i, end: i + 1999 } );
      }

      await Promise.all( splitLoop.map( ( item ) => {
        for ( let i=item.start; i<=item.end; i++ ) {
          const row = sheet.getRow( i );
          if ( i > rowStart - 1 ) {
            row.values = [ '', '', '', '', '', '', '', '', '', '', '', '' ];
          }
          if ( !lockedRowNumber.includes( i ) && i != 1 ) {
            row.eachCell( ( cell ) => {
              const columnLetter = cell.address.replace( /[0-9]/g, '' );
              if ( columnLetter != 'A' ) {
                cell.protection = { locked: false };
              }
            } );
          }
        }
      } ) );


      let dropDownRange = [ { key: `C2:C${maxRows}`, optionList: [ '"Wall,Floor"' ] }, { key: `I2:I${maxRows}`, optionList: [ '"Shelf,Tray"' ] } ];

      dropDownRange.forEach( ( ele ) => {
        sheet.dataValidations.add( ele.key, {
          type: 'list',
          allowBlank: true,
          formulae: ele.optionList,
          showErrorMessage: true,
          errorTitle: 'Invalid Choice',
          error: 'Please select from the dropdown list.',
        } );
      } );


      await sheet.protect( 'password123', {
        selectLockedCells: false,
        selectUnlockedCells: true,
      } );

      sheet.columns.forEach( ( column ) => {
        let maxLength = 10;
        column.eachCell( { includeEmpty: true }, ( cell ) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          if ( cellValue.length > maxLength ) {
            maxLength = cellValue.length;
          }
        } );
        column.width = maxLength + 2;
      } );
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader( 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
      res.setHeader( 'Content-Disposition', 'attachment; filename="Fixture Library.xlsx"' );
      return res.send( buffer );
    }
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
    let FixLibCode = await getMaxFixtureLibCode();
    fixtureLibDetails.fixtureLibCode = FixLibCode;
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
