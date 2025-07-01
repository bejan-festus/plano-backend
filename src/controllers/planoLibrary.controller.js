import { logger, fileUpload } from 'tango-app-api-middleware';
import * as planoLibraryService from '../service/planoLibrary.service.js';
import * as fixtureTemplateService from '../service/fixtureConfig.service.js';
import * as vmTypeService from '../service/vmType.service.js';
import * as planoProductService from '../service/planoproductCategory.service.js';
import * as planoStaticService from '../service/planoStaticData.service.js';
import * as vmService from '../service/planoVm.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as planoService from '../service/planogram.service.js';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
const ObjectId = mongoose.Types.ObjectId;
import path from 'path';

export async function fixtureBulkUpload( req, res ) {
  try {
    let inputData = req.body;
    let groupedData = inputData.fixtureData.reduce( ( acc, ele ) => {
      if ( !acc[ele.fixtureName] ) {
        acc[ele.fixtureName] = {
          clientId: inputData.clientId,
          fixtureCategory: ele.fixtureName,
          fixtureType: ele.fixtureType,
          fixtureLength: {
            value: ele.height,
            unit: 'ft',
          },
          fixtureWidth: {
            value: ele.width,
            unit: 'ft',
          },
          fixtureLibCode: ele?.fixLibCode || '',
          header: {
            height: {
              value: ele.headerHeight,
              unit: 'ft',
            },
          },
          footer: {
            height: {
              value: ele.footerHeight,
              unit: 'ft',
            },
          },
          shelfConfig: [
            {
              shelfNumber: ele.shelfNumber,
              shelfType: ele.shelfType,
              trayRows: ele.shelfType =='shelf' ? 0 : ele.trayRows,
              productPerShelf: ele.productPerShelf,
              label: ele.shelfName,
            },
          ],
          ...( typeof ele?.isEdit == undefined ) ? { 'status': ele?.fixLibCode ? inputData.updateFixtureStatus : inputData.newFixtureStatus } :{},
          fixtureCapacity: ele.shelfType =='shelf' ? ele.productPerShelf : ele.trayRows * ele.productPerShelf,
        };
      } else {
        acc[ele.fixtureName].fixtureCapacity = acc[ele.fixtureName].fixtureCapacity + ( ele.shelfType =='shelf' ? ele.productPerShelf : ele.trayRows * ele.productPerShelf );
        acc[ele.fixtureName].shelfConfig.push(
            {
              shelfNumber: ele.shelfNumber,
              shelfType: ele.shelfType,
              trayRows: ele.shelfType =='shelf' ? 0 : ele.trayRows,
              productPerShelf: ele.productPerShelf,
              label: ele.shelfName,
            },
        );
      }
      return acc;
    }, {} );
    // let fixtureData = [];
    for ( let ele of Object.keys( groupedData ) ) {
      // if ( groupedData[ele]?.fixtureLibCode && !groupedData[ele]?.status ) {
      //   await planoLibraryService.updateOne( { fixtureLibCode: groupedData[ele]?.fixtureLibCode }, groupedData[ele] );
      // } else {
      let FixLibCode = await getMaxFixtureLibCode();
      groupedData[ele].fixtureLibCode = FixLibCode;
      // fixtureData.push( groupedData[ele] );
      await planoLibraryService.upsertOne( { 'fixtureCategory': groupedData[ele].fixtureCategory, 'fixtureWidth.value': groupedData[ele].fixtureWidth.value, 'fixtureWidth.unit': groupedData[ele].fixtureWidth.unit }, groupedData[ele] );
      // }
    }
    // let deleteList = inputData.deleteFixtureList.map( ( ele ) => new ObjectId( ele ) );
    // if ( deleteList.length ) {
    //   await planoLibraryService.deleteMany( { _id: { $in: deleteList } } );
    // }
    // await planoLibraryService.insertMany( fixtureData );
    return res.sendSuccess( 'Fixture library created successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'fixtureBulkUpload', error: e } );
    return res.sendError( e, 500 );
  }
}

async function getMaxFixtureLibCode() {
  try {
    let getFixtureLibDetails = await planoLibraryService.find( { fixtureLibCode: { $exists: true } }, { fixtureLibCode: 1 } );
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
    let query = [
      {
        $addFields: {
          fixtureCategoryLower: { $toLower: '$fixtureCategory' },
        },
      },
      {
        $match: {
          'clientId': req.body.clientId,
          'fixtureCategoryLower': req.body.fixtureCategory.toLowerCase(),
          'fixtureWidth.value': 10,
        },
      },
    ];
    let fixLibDetails = await planoLibraryService.aggregate( query );
    if ( fixLibDetails.length ) {
      return res.sendError( `Fixture Name ${req.body.fixtureCategory} already Exists`, 400 );
    }
    let data ={
      clientId: req.body.clientId,
      fixtureCategory: req.body.fixtureCategory,
      fixtureType: req.body.fixtureType,
      fixtureLibCode: FixLibCode,
      fixtureStaticLength: {
        'value': 1524,
        'unit': 'mm',
      },
      fixtureStaticWidth: {
        'value': 1220,
        'unit': 'mm',
      },
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
    let templateMapped = await fixtureTemplateService.find( { fixtureLibraryId: req.params.fixtureId } );
    if ( templateMapped.length ) {
      return res.sendError( 'Fixture library is mapped with template', 400 );
    }
    let query = [
      {
        $addFields: {
          fixtureCategoryLower: { $toLower: '$fixtureCategory' },
        },
      },
      {
        $match: {
          'clientId': req.body.clientId,
          'fixtureCategoryLower': req.body.fixtureCategory.toLowerCase(),
          'fixtureWidth.value': req.body.fixtureWidth.value,
          '_id': { $ne: req.params.fixtureId },
        },
      },
    ];
    let fixLibDetails = await planoLibraryService.aggregate( query );
    if ( fixLibDetails.length ) {
      return res.sendError( `${req.body.fixtureCategory} is already exists`, 400 );
    }

    let fixtureData = {
      ...req.body,
      updatedAt: new Date(),
    };
    await planoLibraryService.updateOne( { _id: req.params.fixtureId }, fixtureData );
    return res.sendSuccess( 'Fixture library details updated successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'updateFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getFixture( req, res ) {
  try {
    if ( !req.query?.fixtureId ) {
      return res.sendError( 'FixtureId is required', 400 );
    }
    let fixtureLibDetails = await planoLibraryService.findOne( { _id: req.query?.fixtureId } );
    if ( !fixtureLibDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let fixtureTemplateDetails = await fixtureTemplateService.find( { fixtureLibraryId: req.query?.fixtureId } );
    let fixtureDetails = await storeFixtureService.findOne( { fixtureLibraryId: req.query?.fixtureId }, { planoId: 1 } );
    if ( fixtureDetails ) {
      let planoStatus = await planoService.findOne( { planoId: fixtureDetails.planoId }, { status: 1 } );
      if ( planoStatus ) {
        fixtureLibDetails.status = planoStatus.status == 'complete' ? 'active' :'inactive';
      }
    } else {
      fixtureLibDetails.status = fixtureLibDetails.status == 'draft' ? 'draft' : 'inactive';
    }
    fixtureLibDetails = {
      ...fixtureLibDetails.toObject(),
      templateId: fixtureTemplateDetails.length,
    };
    return res.sendSuccess( fixtureLibDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getFixture', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function FixtureLibraryList( req, res ) {
  try {
    let limit = req.body?.limit || 10;
    let page = req.body?.offset || 1;
    let skip = limit * ( page - 1 );

    const matchStage = {
      clientId: req.body.clientId,
      ...( req.body?.searchValue ?
    { $or: [ { fixtureCategory: { $regex: req.body.searchValue, $options: 'i' } }, { fixtureCategorySize: { $regex: req.body.searchValue, $options: 'i' } } ] } :
    {} ),
      ...( req.body?.filter?.type?.length ?
    { fixtureType: { $in: req.body.filter.type } } :
    {} ),
      ...( req.body?.filter?.size?.length ?
    { 'fixtureWidth.value': { $in: req.body.filter.size } } :
    {} ),
    };

    const query = [
      {
        $addFields: {
          fixtureCategorySize: {
            $concat: [ '$fixtureCategory', ' - ', { $toString: '$fixtureWidth.value' }, { $toString: '$fixtureWidth.unit' } ],
          },
        },
      },
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
          fixtureCategorySize: 1,
          fixtureWidth: 1,
          fixtureHeight: 1,
          fixtureLength: 1,
          shelfConfig: 1,
          shelfCount: { $size: '$shelfConfig' },
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
          shelfCount: 1,
          fixtureCategory: 1,
          clientId: 1,
          fixtureType: 1,
          status: 1,
          templateId: 1,
          header: 1,
          footer: 1,
          fixtureLibCode: 1,
          planoId: { $ifNull: [ { $arrayElemAt: [ '$storeFixtureDetails.planoId', 0 ] }, [] ] },
          templateCount: { $size: '$templateId' },
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
          shelfCount: 1,
          fixtureCategory: 1,
          clientId: 1,
          planoId: 1,
          templateId: 1,
          header: 1,
          footer: 1,
          templateCount: 1,
          fixtureLibCode: 1,
          planoStatus: { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] },
          status: {
            $cond: {
              if: { $and: [ { $in: [ 'completed', { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] } ] }, { $gt: [ { $size: '$templateId' }, 0 ] } ] },
              then: 'active',
              else: {
                $cond: {
                  if: {
                    $eq: [ '$status', 'draft' ],
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
      if ( req.body?.sortColumnName == 'shelfConfig' ) {
        req.body.sortColumnName = 'shelfCount';
      }
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
              fixtureData: [ { $skip: skip }, { $limit: limit } ],
            } : { fixtureData: [ { $skip: skip } ] },
            count: [ { $count: 'total' } ],
          },
        },
    );
    let fixtureDetails = await planoLibraryService.aggregate( query );
    if ( !req.body.export && !fixtureDetails[0]?.fixtureData.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      count: fixtureDetails[0]?.count?.[0]?.total || 0,
      data: fixtureDetails[0]?.fixtureData || [],
    };
    if ( !req.body.export ) {
      return res.sendSuccess( result );
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet( 'Fixture Library' );

      sheet.getRow( 1 ).values = [ 'Fixture Name', 'Fixture Type', 'Fixture Height(ft)', 'Fixture Width(ft)', 'Fixture Header Height(ft)', 'Fixture Footer Height(ft)', 'Shelf Number', 'Shelf Type', 'Tray Rows', 'Product Per Shelf/Tray', 'Panel Name' ];

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
        if ( result.data[i]?.fixtureLength ) {
          height = result.data[i].fixtureLength.value;
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
          // result.data[i]?.fixtureLibCode || '',
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, 0, '', 0, 0, '' ];
          if ( result.data[i].status == 'active' || result.data[i].templateId.length ) {
            lockedRowNumber.push( rowStart );
          }
          rowStart = rowStart + 1;
        }

        result.data[i].shelfConfig.forEach( ( shelf ) => {
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, shelf?.shelfNumber || 0, shelf?.shelfType || '', shelf?.trayRows || 0, shelf?.productPerShelf || 0, shelf?.label || '' ];
          if ( result.data[i].status == 'active' || result.data[i].templateId.length ) {
            lockedRowNumber.push( rowStart );
          }
          rowStart = rowStart + 1;
        } );
      }


      const maxRows = 1048576;

      // let unlockCellValues = 20000;
      // let splitLoop = [];

      // for ( let i=1; i<=unlockCellValues; i+=2000 ) {
      //   splitLoop.push( { start: i, end: i + 1999 } );
      // }

      // await Promise.all( splitLoop.map( ( item ) => {
      //   for ( let i=item.start; i<=item.end; i++ ) {
      //     const row = sheet.getRow( i );
      //     if ( i > rowStart - 1 ) {
      //       row.values = [ '', '', '', '', '', '', '', '', '', '', '', '' ];
      //     }
      //     if ( !lockedRowNumber.includes( i ) && i != 1 ) {
      //       row.eachCell( ( cell ) => {
      //         const columnLetter = cell.address.replace( /[0-9]/g, '' );
      //         if ( columnLetter != 'A' ) {
      //           cell.protection = { locked: false };
      //         }
      //       } );
      //     }
      //   }
      // } ) );


      let dropDownRange = [ { key: `B2:B${maxRows}`, optionList: [ '"wall,floor"' ] }, { key: `H2:H${maxRows}`, optionList: [ '"shelf,tray"' ] } ];

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


      // await sheet.protect( 'password123', {
      //   selectLockedCells: false,
      //   selectUnlockedCells: true,
      // } );

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
    logger.error( { functionName: 'FixtureLibraryList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function duplicateFixture( req, res ) {
  try {
    if ( !req.body?.fixtureId ) {
      return res.sendError( 'FixtureId is required', 400 );
    }
    let fixtureLibDetails = await planoLibraryService.findOne( { _id: req.body?.fixtureId }, { createdAt: 0, updatedAt: 0 } );
    if ( !fixtureLibDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    fixtureLibDetails = fixtureLibDetails.toObject();
    delete fixtureLibDetails._id;
    let getAllLibraryList = await planoLibraryService.findAndSort( { fixtureCategory: { $regex: fixtureLibDetails.fixtureCategory.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), $options: 'i' } }, { fixtureCategory: 1 }, { fixtureCategory: -1 } );
    let counter = 1;
    let newFixName = fixtureLibDetails.fixtureCategory + ` (${counter})`;
    if ( getAllLibraryList?.length ) {
      let fixtureNameList = getAllLibraryList.map( ( ele ) => ele.fixtureCategory );
      while ( fixtureNameList.includes( newFixName ) ) {
        newFixName = fixtureLibDetails.fixtureCategory + ` (${counter})`;
        counter++;
      }
    }
    fixtureLibDetails.fixtureCategory = newFixName;
    let FixLibCode = await getMaxFixtureLibCode();
    fixtureLibDetails.fixtureLibCode = FixLibCode;
    let duplicateData = await planoLibraryService.create( fixtureLibDetails );
    return res.sendSuccess( { message: 'Fixture duplicated successfully', id: duplicateData._id } );
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

export async function getFixLibWidth( req, res ) {
  try {
    if ( !req.query?.clientId ) {
      return res.sendError( 'Client id is required', 400 );
    }
    let getLibDetails = await planoLibraryService.find( { clientId: req.query.clientId }, { fixtureWidth: 1 } );
    if ( !getLibDetails ) {
      return res.sendError( 'No data content', 204 );
    }

    getLibDetails = [ ...new Set( getLibDetails.map( ( item ) => item.fixtureWidth.value ) ) ];
    return res.sendSuccess( getLibDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getFixLibWidth', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function addVmType( req, res ) {
  try {
    let inputData = req.body;
    let vmTypeList = [];
    let error = [];
    inputData.vmData.forEach( ( ele ) => {
      ele.clientId = inputData.clientId;
      if ( vmTypeList.includes( ele.vmType.toLowerCase() ) ) {
        error.push( ele.vmType );
      }
      vmTypeList.push( ele.vmType.toLowerCase() );
    } );
    if ( error.length ) {
      return res.sendError( `${error.toString()} - Vm types are duplicated.`, 400 );
    }
    await vmTypeService.deleteMany( { clientId: inputData.clientId, _id: { $ne: req.body.mappedTypeList } } );
    await vmTypeService.insertMany( inputData.vmData );
    return res.sendSuccess( 'Vm type is created successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'addVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deleteVmType( req, res ) {
  try {
    if ( !req.body?.vmId ) {
      return res.sendError( 'Vm id is required', 400 );
    }
    let vmtypeDetails = await vmTypeService.findOne( { _id: req.body.vmId } );
    if ( !vmtypeDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let mappedType = await vmService.findOne( { vmType: vmtypeDetails.vmType } );
    if ( mappedType ) {
      return res.sendError( `${vmtypeDetails.vmType}-vmtype is mapped with Vmlibrary`, 400 );
    }
    await vmTypeService.deleteOne( { _id: req.body.vmId } );
    return res.sendSuccess( 'Vmtype is deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function uploadVmImage( req, res ) {
  try {
    if ( !req.files?.file ) {
      return res.sendError( 'file is required', 400 );
    }
    if ( !req.params?.vmId ) {
      return res.sendError( 'id is required', 400 );
    }
    let params = {
      Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
      Key: `vmType/${req.params.vmId}/`,
      fileName: Date.now() +'.'+ req.files?.file?.name?.split( '.' )?.slice( -1 )?.[0],
      ContentType: req.files.file.mimeType,
      body: req.files.file.data,
    };
    let fileRes = await fileUpload( params );
    if ( fileRes.Key ) {
      await vmTypeService.updateKeys( { _id: req.params.vmId }, { $push: { imageUrls: fileRes.Key } } );
      return res.sendSuccess( { url: fileRes.Key } );
    }
  } catch ( e ) {
    logger.error( { functionName: 'updateVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getVmTypeList( req, res ) {
  try {
    let vmDetails = await vmTypeService.find( { ...( req.query.clientId ) ? { clientId: req.query.clientId } : {}, ...( req.query.id ) ? { _id: req.query.id } : {} }, { createdAt: 0, updatedAt: 0 } );
    vmDetails = await Promise.all( vmDetails.map( async ( ele ) => {
      ele= { ...ele.toObject(), isUsed: false };
      let mappedDetails = await vmService.findOne( { vmType: ele.vmType } );
      if ( mappedDetails ) {
        ele['isUsed'] = true;
      }
      return ele;
    } ) );
    return res.sendSuccess( vmDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getVmTypeList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deletevmTypeImage( req, res ) {
  try {
    let getVmDetails = await vmTypeService.findOne( { _id: req.body.vmId } );
    if ( !getVmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    getVmDetails.imageUrls.splice( req.body.index, 1 );
    getVmDetails.save();
    return res.sendSuccess( 'Image removed successfullly' );
  } catch ( e ) {
    logger.error( { functionName: 'getVmTypeList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getBrandList( req, res ) {
  try {
    let getBrandDetails = await planoProductService.find( { clientId: req.body.clientId }, { createdAt: 0, updatedAt: 0 } );

    getBrandDetails = await Promise.all( getBrandDetails.map( async ( ele ) => {
      ele = { ...ele.toObject(), isUsed: false };
      let mappedDetails = await vmService.findOne( { vmBrand: ele.brandName } );
      if ( mappedDetails ) {
        ele.isUsed = true;
      }
      return ele;
    } ) );
    if ( !req?.body?.export ) {
      return res.sendSuccess( getBrandDetails );
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet( 'Brand Details' );

      sheet.getRow( 1 ).values = [ 'Brand Name', 'Brand Category', 'Brand SubCategory' ];

      // let rowStart = 2;
      // let lockedRowNumber = [];
      if ( req.body.emptyDownload ) {
        getBrandDetails = [];
      }
      // getBrandDetails.forEach( ( ele ) => {
      //   sheet.getRow( rowStart ).values = [ ele.brandName, ele.category.toString(), ele.subCategory.toString() ];
      //   if ( ele.isUsed ) {
      //     lockedRowNumber.push( rowStart );
      //   }
      //   rowStart = rowStart + 1;
      // } );

      // let unlockCellValues = 20000;
      // let splitLoop = [];

      // for ( let i=1; i<=unlockCellValues; i+=2000 ) {
      //   splitLoop.push( { start: i, end: i + 1999 } );
      // }

      // await Promise.all( splitLoop.map( ( item ) => {
      //   for ( let i=item.start; i<=item.end; i++ ) {
      //     const row = sheet.getRow( i );
      //     if ( i > rowStart - 1 ) {
      //       row.values = [ '', '', '', '', '', '', '', '', '', '' ];
      //     }
      //     if ( !lockedRowNumber.includes( i ) && i != 1 ) {
      //       row.eachCell( ( cell ) => {
      //         cell.protection = { locked: false };
      //       } );
      //     }
      //   }
      // } ) );

      // await sheet.protect( 'password123', {
      //   selectLockedCells: false,
      //   selectUnlockedCells: true,
      // } );

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
      res.setHeader( 'Content-Disposition', 'attachment; filename="Brand Details.xlsx"' );

      return res.send( buffer );
    }
  } catch ( e ) {
    logger.error( { functionName: 'getBrandList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function addUpdateBrandList( req, res ) {
  try {
    let inputData = req.body;
    inputData.brandUsedList = inputData.brandUsedList.map( ( ele ) => new ObjectId( ele ) );
    let brandData = [];
    inputData.brandData.forEach( ( ele ) => {
      if ( !ele?.isUsed ) {
        brandData.push( {
          clientId: inputData.clientId,
          brandName: ele.brand,
          category: [ ...new Set( ele?.category?.map( ( ele ) => ele ) ) ],
          subCategory: [ ...new Set( ele?.subCategory?.map( ( ele ) => ele ) ) ],
        } );
      }
    } );
    await planoProductService.deleteMany( { clientId: inputData.clientId, _id: { $nin: inputData.brandUsedList } } );
    await planoProductService.insertMany( brandData );
    return res.sendSuccess( 'Brand Details updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'addBrandList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function uploadBrandList( req, res ) {
  try {
    let inputData = req.body;

    let brandData = inputData.brandData.reduce( ( acc, ele ) => {
      let category = ele?.['Brand Category'].split( ',' );
      let subCategory = ele?.['Brand SubCategory'].split( ',' );
      if ( !acc[ele['Brand Name']] ) {
        acc[ele['Brand Name']] = {
          brandName: ele['Brand Name'],
          clientId: inputData.clientId,
          category: [ ...new Set( category?.filter( ( ele ) => ele ).map( ( ele ) => ele ) ) ],
          subCategory: [ ...new Set( subCategory?.filter( ( ele ) => ele ).map( ( ele ) => ele ) ) ],
        };
      } else {
        category.forEach( ( cat ) => {
          if ( !acc[ele['Brand Name']].category.includes( cat ) ) {
            acc[ele['Brand Name']].category.push( cat );
          }
        } );
        if ( subCategory.length ) {
          subCategory.forEach( ( cat ) => {
            if ( !acc[ele['Brand Name']].subCategory.includes( cat ) ) {
              acc[ele['Brand Name']].subCategory.push( cat );
            }
          } );
        }
      }
      return acc;
    }, {} );
    await Promise.all( Object.keys( brandData ).map( async ( brand ) => {
      let brandLower = brand.toLowerCase();
      let query = [
        {
          $addFields: {
            brandLower: { $toLower: '$brandName' },
          },
        },
        {
          $match: {
            brandLower: brandLower,
            clientId: inputData.clientId,
          },
        },
      ];
      let brandDetails = await planoProductService.aggregate( query );
      if ( brandDetails.length ) {
        let getCategory = brandDetails[0]?.category;
        let getsubCategory = brandDetails[0]?.subCategory;
        brandData[brand].category.forEach( ( ele ) => {
          if ( !getCategory.includes( ele ) ) {
            getCategory.push( ele );
          }
        } );
        brandData[brand].subCategory.forEach( ( ele ) => {
          if ( !getsubCategory.includes( ele ) ) {
            getsubCategory.push( ele );
          }
        } );
        await planoProductService.updateOne( { _id: brandDetails[0]._id }, { category: getCategory, subCategory: getsubCategory } );
      } else {
        await planoProductService.create( brandData[brand] );
      }
    } ) );

    return res.sendSuccess( 'Brand details upload successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'uploadBrandList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getTaskConfig( req, res ) {
  try {
    let taskConfigDetails = await planoStaticService.findOne( { clientId: req.query.clientId, type: 'task' }, { updatedAt: 0, createdAt: 0 } );
    if ( !taskConfigDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    taskConfigDetails = { ...taskConfigDetails.toObject() };
    taskConfigDetails.dueTime = dayjs( taskConfigDetails.dueTime, 'hh:mm A' ).format( 'HH:mm' );
    return res.sendSuccess( taskConfigDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getTaskConfig', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateTaskConfig( req, res ) {
  try {
    let inputData = req.body;
    inputData.type = 'task';
    inputData.dueTime = dayjs( inputData.dueTime, 'HH:mm' ).format( 'hh:mm A' );
    await planoStaticService.updateOne( { clientId: req.body.clientId, type: 'task' }, inputData );
    return res.sendSuccess( 'Task config updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateTaskConfig', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function addUpdateVm( req, res ) {
  try {
    let query = [
      {
        $addFields: {
          name: { $toLower: '$vmName' },
        },
      },
      {
        $match: {
          clientId: req.body.clientId,
          name: req.body.vmName.toLowerCase(),
          ...( req.body._id ) ? { _id: { $ne: new ObjectId( req.body._id ) } } : {},
        },
      },
    ];
    let checkVmExists = await vmService.aggregate( query );
    if ( checkVmExists.length ) {
      return res.sendError( 'VmName is already exists', 400 );
    }
    // if ( req.body?.vmImageUrl && ( req.body?.vmImageUrl.startsWith( 'https://' ) || req.body?.vmImageUrl.startsWith( 'http://' ) ) ) {
    //   req.body.vmImageUrl = req.body?.vmImageUrl.split( '?' )?.[0]?.split( '/' );
    //   req.body.vmImageUrl.splice( 0, 3 );
    //   req.body.vmImageUrl = decodeURIComponent( req.body.vmImageUrl.join( '/' ) );
    // }
    if ( !req.body?._id ) {
      req.body.vmLibCode = await getMaxVMLibCode();
    }
    let vmResponse =await vmService.updateOne( { clientId: req.body.clientId, ...( req.body._id ) ? { _id: req.body._id } : { vmName: req.body.vmName } }, req.body );
    let message = req.body?._id ? 'updated' : 'added';
    return res.sendSuccess( { message: `Vm data ${message} successfully`, ...( vmResponse?.upsertedId ) ? { id: vmResponse.upsertedId } : {} } );
  } catch ( e ) {
    logger.error( { functionName: 'addVm', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getVmLibList( req, res ) {
  try {
    let limit = req.body?.limit || 10;
    let page = req.body?.offset || 1;
    let skip = limit * ( page - 1 );

    const matchStage = {
      clientId: req.body.clientId,
      ...( req.body?.searchValue ?
    { vmName: { $regex: req.body.searchValue, $options: 'i' } } :
    {} ),
      ...( req.body?.filter?.type?.length ?
    { vmType: { $in: req.body.filter.type } } :
    {} ),
      ...( req.body?.filter?.brand?.length ?
    { vmBrand: { $in: req.body.filter.brand } } :
    {} ),
      ...( req.body?.filter?.category?.length ?
    { vmCategory: { $in: req.body.filter.category } } :
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
                  $in: [ '$$libraryId', { $ifNull: [ '$vmConfig.vmId', [] ] } ],
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
          vmName: 1,
          vmType: 1,
          vmBrand: 1,
          vmCategory: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
          vmSubCategory: 1,
          vmLibCode: 1,
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
                  $in: [ '$$libraryId', { $ifNull: [ '$vmConfig.vmId', [] ] } ],
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
          vmName: 1,
          vmType: 1,
          vmBrand: 1,
          vmCategory: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
          templateId: 1,
          vmLibCode: 1,
          vmSubCategory: 1,
          planoId: { $ifNull: [ { $arrayElemAt: [ '$storeFixtureDetails.planoId', 0 ] }, [] ] },
          templateCount: { $size: '$templateId' },
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
          vmName: 1,
          vmType: 1,
          vmBrand: 1,
          vmCategory: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
          templateId: 1,
          planoId: 1,
          vmLibCode: 1,
          vmSubCategory: 1,
          planoStatus: { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] },
          templateCount: 1,
          status: {
            $cond: {
              if: { $and: [ { $in: [ 'completed', { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] } ] }, { $gt: [ { $size: '$templateId' }, 0 ] } ] },
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
              fixtureData: [ { $skip: skip }, { $limit: limit } ],
            } : { fixtureData: [ { $skip: skip } ] },
            count: [ { $count: 'total' } ],
          },
        },
    );
    let fixtureDetails = await vmService.aggregate( query );
    if ( !req.body.export && !fixtureDetails[0]?.fixtureData.length ) {
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
      const hiddenSheet = workbook.addWorksheet( 'Hidden' );
      hiddenSheet.state = 'veryHidden';

      // 'VM Lib Code',

      sheet.getRow( 1 ).values = [ 'VM Name', 'VM Type', 'VM Brand', 'VM Category', 'VM SubCategory', 'Unit', 'VM Height', 'VM Width', 'VM ImageUrl' ];

      let rowStart = 2;
      let lockedRowNumber = [];
      if ( req.body.emptyDownload ) {
        result.data = [];
      }
      for ( let i=0; i<result.data.length; i++ ) {
        let height = 0;
        let width = 0;
        let unit = 'mm';
        if ( result.data[i]?.vmHeight ) {
          height = result.data[i].vmHeight.value;
          unit = result.data[i].vmHeight.unit;
        }
        if ( result.data[i]?.vmWidth ) {
          width = result.data[i].vmWidth.value;
          unit = result.data[i].vmWidth.unit;
        }
        if ( result.data[i]?.vmImageUrl ) {
          result.data[i].vmImageUrl = process.env.PLANOCDNURL +'/'+result.data[i].vmImageUrl;
        }
        // result.data[i]?.vmLibCode || '',
        sheet.getRow( rowStart ).values = [ result.data[i]?.vmName || '', result.data[i]?.vmType || '', result.data[i]?.vmBrand || '', result.data[i]?.vmCategory || '', result.data[i]?.vmSubCategory ||'', unit, height, width, result.data[i]?.vmImageUrl || '' ];
        if ( result.data[i].templateId.length || result.data[i].status == 'active' ) {
          lockedRowNumber.push( rowStart );
        }
        rowStart = rowStart + 1;
      }

      let productBrandDetails = await planoProductService.find( { clientId: req.body.clientId } );
      let vmTypeList = await vmTypeService.find( { clientId: req.body.clientId } );
      vmTypeList = vmTypeList.map( ( ele ) => ele.vmType );
      let brandList = productBrandDetails.map( ( ele ) => ele.brandName );
      brandList.forEach( ( brand, index ) => {
        hiddenSheet.getCell( `A${index + 1}` ).value = brand;
      } );
      let brandCategories = productBrandDetails.flatMap( ( ele ) => [ ...ele.category ] );
      let brandSubCategories = productBrandDetails.flatMap( ( ele ) => [ ...ele.subCategory ] );
      brandCategories = [ ...new Set( brandCategories.map( ( ele ) => ele ) ) ];
      brandCategories = brandCategories.length ? brandCategories : [ '' ];
      brandSubCategories = brandSubCategories.length ? brandSubCategories : [ '' ];
      brandCategories.forEach( ( brand, index ) => {
        hiddenSheet.getCell( `B${index + 1}` ).value = brand;
      } );
      brandSubCategories = [ ...new Set( brandSubCategories.map( ( ele ) => ele ) ) ];
      brandSubCategories.forEach( ( brand, index ) => {
        hiddenSheet.getCell( `C${index + 1}` ).value = brand;
      } );

      const maxRows = 1048576;

      let dropDownRange = [ { key: `B2:B${maxRows}`, optionList: [ `"${vmTypeList.toString()}"` ] }, { key: `C2:C${maxRows}`, optionList: [ `=Hidden!$A$1:$A$${brandList.length}` ] }, { key: `D2:D${maxRows}`, optionList: [ `=Hidden!$B$1:$B$${brandCategories.length}` ] }, { key: `E2:E${maxRows}`, optionList: [ `=Hidden!$C$1:$C$${brandSubCategories.length}` ] }, { key: `F2:F${maxRows}`, optionList: [ '"mm,cm,inches,feet"' ] } ];


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

      // let unlockCellValues = 20000;
      // let splitLoop = [];

      // for ( let i=1; i<=unlockCellValues; i+=2000 ) {
      //   splitLoop.push( { start: i, end: i + 1999 } );
      // }

      // await Promise.all( splitLoop.map( ( item ) => {
      //   for ( let i=item.start; i<=item.end; i++ ) {
      //     const row = sheet.getRow( i );
      //     if ( i > rowStart - 1 ) {
      //       row.values = [ '', '', '', '', '', '', '', '', '', '' ];
      //     }
      //     if ( !lockedRowNumber.includes( i ) && i != 1 ) {
      //       row.eachCell( ( cell ) => {
      //         const columnLetter = cell.address.replace( /[0-9]/g, '' );
      //         if ( columnLetter != 'A' ) {
      //           cell.protection = { locked: false };
      //         }
      //       } );
      //     }
      //   }
      // } ) );

      // await sheet.protect( 'password123', {
      //   selectLockedCells: false,
      //   selectUnlockedCells: true,
      // } );

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
      res.setHeader( 'Content-Disposition', 'attachment; filename="VM Library.xlsx"' );
      return res.send( buffer );
    }
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'getVmList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function duplicateVmLib( req, res ) {
  try {
    if ( !req.body?.vmId ) {
      return res.sendError( 'VmId is required', 400 );
    }
    let vmDetails = await vmService.findOne( { _id: req.body?.vmId }, { createdAt: 0, updatedAt: 0 } );
    if ( !vmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    vmDetails = vmDetails.toObject();
    delete vmDetails._id;
    let getAllLibraryList = await vmService.findAndSort( { vmName: { $regex: vmDetails.vmName.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), $options: 'i' } }, { vmName: 1 }, { vmName: -1 } );
    let counter = 1;
    let newVMName = vmDetails.vmName + ` (${counter})`;
    if ( getAllLibraryList?.length ) {
      let vmNameList = getAllLibraryList.map( ( ele ) => ele.vmName );
      while ( vmNameList.includes( newVMName ) ) {
        newVMName = vmDetails.vmName + ` (${counter})`;
        counter++;
      }
    }
    vmDetails.vmName = newVMName;
    vmDetails.vmLibCode = await getMaxVMLibCode();
    let duplicateData = await vmService.create( vmDetails );
    return res.sendSuccess( { message: 'VM duplicated successfully', id: duplicateData._id } );
  } catch ( e ) {
    logger.error( { functionName: 'duplicateVMLib', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deleteVmLibrary( req, res ) {
  try {
    if ( !req.body?.vmId ) {
      return res.sendError( 'vmId is required', 400 );
    }
    let vmDetails = await vmService.findOne( { _id: req.body?.vmId } );
    if ( !vmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let vmTemplate = await fixtureTemplateService.count( { 'vmConfig.vmId': { $in: req.body.vmId } } );
    if ( vmTemplate ) {
      return res.sendError( `VM is mapped with ${vmTemplate} templates`, 400 );
    }
    await vmService.deleteOne( { _id: req.body?.vmId } );
    return res.sendSuccess( 'VM deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteVmLibrary', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getVmDetails( req, res ) {
  try {
    if ( !req.query?.vmId ) {
      return res.sendError( 'Vm id is required', 400 );
    }
    let getVmDetails = await vmService.findOne( { _id: req.query.vmId } );
    if ( !getVmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    getVmDetails = getVmDetails.toObject();
    getVmDetails.templateCount = 0;
    let templateDetails = await fixtureTemplateService.find( { 'vmConfig.vmId': { $in: req.query.vmId } } );
    if ( getVmDetails.status != 'draft' ) {
      getVmDetails.status = 'inactive';
      if ( templateDetails.length ) {
        getVmDetails.templateCount = templateDetails.length;
        let fixtureDetails = await storeFixtureService.find( { 'vmConfig.vmId': { $in: req.query.vmId } }, { planoId: 1 } );
        if ( fixtureDetails.length ) {
          let planoList = fixtureDetails.map( ( ele ) => ele.planoId );
          let planoDetails = await planoService.find( { _id: { $in: planoList } }, { status: 1 } );
          planoDetails = planoDetails.map( ( ele ) => ele.status );
          if ( planoDetails.includes( 'completed' ) ) {
            getVmDetails.status = 'active';
          }
        }
      }
    }
    return res.sendSuccess( getVmDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getVmDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function vmBulkUpload( req, res ) {
  try {
    let inputData = req.body;

    for ( let ele of inputData.vmData ) {
      ele = { ...ele, clientId: req.body.clientId, vmWidth: { value: ele.vmWidth, unit: ele.unit }, vmHeight: { value: ele.vmHeight, unit: ele.unit } };
      ele.vmLibCode = await getMaxVMLibCode();
      ele.status = inputData.newVmStatus;
      if ( vmLibData && !ele?.vmImageUrl.includes( '/vmType/' ) && ele?.vmImageUrl ) {
        let response = await fetch( ele?.vmImageUrl );
        let arrayBuffer = await response.arrayBuffer();
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          Key: `vmType/${vmLibData._id}/${Date.now()}/${path.basename( ele?.vmImageUrl )}`,
          fileName: path.basename( ele?.vmImageUrl ),
          ContentType: response.headers.get( 'content-type' ),
          body: Buffer.from( arrayBuffer ),
        };
        let fileRes = await fileUpload( params );
        ele.vmImageUrl = fileRes?.Key;
      }
      vmLibData = await vmService.updateOne( { vmName: ele?.vmName, clientId: inputData.clientId }, ele );
    }
    // await Promise.all( inputData.vmData.map( async ( ele ) => {
    //   ele = { ...ele, clientId: req.body.clientId, vmWidth: { value: ele.vmWidth, unit: ele.unit }, vmHeight: { value: ele.vmHeight, unit: ele.unit } };
    //   let vmLibData;
    //   if ( !ele?.vmLibCode ) {
    //     ele.vmLibCode = await getMaxVMLibCode();
    //     ele.status = inputData.newVmStatus;
    //     vmLibData = await vmService.create( ele );
    //   } else {
    //     if ( typeof ele?.isEdit == undefined ) {
    //       ele.status = inputData.updateVmStatus;
    //       await vmService.updateOne( { vmLibCode: ele.vmLibCode }, ele );
    //       vmLibData = await vmService.findOne( { vmLibCode: ele.vmLibCode } );
    //     }
    //   }
    //   if ( vmLibData && !ele?.vmImageUrl.includes( '/vmType/' ) && ele?.vmImageUrl ) {
    //     let response = await fetch( ele?.vmImageUrl );
    //     let arrayBuffer = await response.arrayBuffer();
    //     let params = {
    //       Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
    //       Key: `vmType/${vmLibData._id}/${Date.now()}/${path.basename( ele?.vmImageUrl )}`,
    //       fileName: path.basename( ele?.vmImageUrl ),
    //       ContentType: response.headers.get( 'content-type' ),
    //       body: Buffer.from( arrayBuffer ),
    //     };
    //     let fileRes = await fileUpload( params );
    //     ele.vmImageUrl = fileRes?.Key;
    //     await vmService.updateOne( { _id: vmLibData._id }, { vmImageUrl: ele.vmImageUrl } );
    //   }
    // } ) );
    // let deleteList = inputData.deleteVmList.map( ( ele ) => new ObjectId( ele ) );
    // if ( deleteList.length ) {
    //   await vmService.deleteMany( { _id: { $in: deleteList } } );
    // }
    return res.sendSuccess( 'Vmlibrary details uploaded successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'vmBulkUpload', error: e } );
    return res.sendError( e, 500 );
  }
}

async function getMaxVMLibCode() {
  try {
    let getVMLibDetails = await vmService.find( { vmLibCode: { $exists: true } }, { vmLibCode: 1 } );
    if ( !getVMLibDetails.length ) {
      return 'VM01';
    } else {
      let numList = getVMLibDetails.map( ( ele ) => ele.vmLibCode.substring( 2 ) );
      let missingNum = [];
      for ( let i=1; i<=getVMLibDetails.length; i++ ) {
        let numPad = String( i ).padStart( 2, '0' );
        if ( !numList.includes( numPad ) ) {
          missingNum.push( numPad );
        }
      }
      if ( missingNum.length ) {
        return 'VM'+ missingNum[0];
      } else {
        return 'VM'+ String( parseInt( getVMLibDetails.length+1 ) ).padStart( 2, '0' );
      }
    }
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'getMaxVMLibCode', error: e } );
    return false;
  }
}
