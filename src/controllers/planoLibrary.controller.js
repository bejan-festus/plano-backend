import { logger, fileUpload, signedUrl } from 'tango-app-api-middleware';
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
const ObjectId = mongoose.Types.ObjectId;

export async function fixtureBulkUpload( req, res ) {
  try {
    let inputData = req.body;
    let groupedData = inputData.fixtureData.reduce( ( acc, ele ) => {
      if ( !acc[ele.fixtureName] ) {
        acc[ele.fixtureName] = {
          'clientId': inputData.clientId,
          'fixtureCategory': ele.fixtureName,
          'fixtureType': ele.fixtureType,
          'fixtureLength': {
            value: ele.length,
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
        acc[ele.fixtureName].shelfConfig.push(
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
    let query = [
      {
        $addFields: {
          fixtureCategoryLower: { $toLower: '$fixtureCategory' },
        },
      },
      {
        $match: {
          clientId: req.body.clientId,
          fixtureCategoryLower: req.body.fixtureCategory.toLowerCase(),
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
    let fixtureDetails = await storeFixtureService.findOne( { fixtureLibraryId: req.params?.fixtureId }, { planoId: 1 } );
    if ( fixtureDetails ) {
      let planoStatus = await planoService.findOne( { planoId: fixtureDetails.planoId }, { status: 1 } );
      if ( planoStatus ) {
        fixtureLibDetails.status = planoStatus.status == 'completed' ? 'Active' :'Inactive';
      }
    } else {
      fixtureLibDetails.status = fixtureLibDetails.status == 'draft' ? 'Draft' : 'Inactive';
    }
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
          fixtureLibCode: 1,
          planoStatus: { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] },
          status: {
            $cond: {
              if: { $in: [ 'completed', { $ifNull: [ { $arrayElemAt: [ '$planoStatus.statusList', 0 ] }, [] ] } ] },
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
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureLibCode || '', result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, 0, '', 0, 0, '' ];
          if ( result.data[i].status == 'active' || result.data[i].templateId.length ) {
            lockedRowNumber.push( rowStart );
          }
          rowStart = rowStart + 1;
        }

        result.data[i].shelfConfig.forEach( ( shelf ) => {
          sheet.getRow( rowStart ).values = [ result.data[i]?.fixtureLibCode || '', result.data[i]?.fixtureCategory || '', result.data[i]?.fixtureType || 'Wall', height, width, headerHeight, footerHeight, shelf?.shelfNumber || 0, shelf?.shelfType || '', shelf?.trayRows || 0, shelf?.productPerShelf || 0, shelf?.label || '' ];
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


      let dropDownRange = [ { key: `C2:C${maxRows}`, optionList: [ '"wall,floor"' ] }, { key: `I2:I${maxRows}`, optionList: [ '"shelf,tray"' ] } ];

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
    logger.error( { functionName: 'FixtureLibraryList', error: e } );
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

    getLibDetails = getLibDetails.map( ( item ) => item.fixtureWidth.value +' '+item.fixtureWidth.unit );
    return res.sendSuccess( getLibDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getFixLibWidth', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function addVmType( req, res ) {
  try {
    let vmData = [];
    req.body.vmData.forEach( ( ele ) => {
      vmData.push( {
        clientId: req.body.clientId,
        vmType: ele,
      } );
    } );
    await vmTypeService.insertMany( vmData );
    return res.sendSuccess( 'Vm type is created successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'addVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateVmImage( req, res ) {
  try {
    if ( !req.files?.file ) {
      return res.sendError( 'file is required', 400 );
    }
    let params = {
      Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
      Key: `vmType/${req.params.id}/${Date.now()}/`,
      fileName: req.files.file.name,
      ContentType: req.files.file.mimeType,
      body: req.files.file.data,
    };
    let fileRes = await fileUpload( params );
    if ( fileRes.Key ) {
      params = {
        Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
        file_path: fileRes.Key,
      };
      let imageUrl = await signedUrl( params );
      await vmTypeService.updateKeys( { _id: req.params.id }, { $push: { imageUrls: fileRes.Key } } );
      return res.sendSuccess( { url: imageUrl, path: fileRes.Key } );
    }
  } catch ( e ) {
    logger.error( { functionName: 'updateVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getVmTypeList( req, res ) {
  try {
    let vmDetails = await vmTypeService.find( { ...( req.query.clientId ) ? { clientId: req.query.clientId } : {}, ...( req.query.id ) ? { _id: req.query.id } : {} } );
    vmDetails = await Promise.all( vmDetails.map( async ( ele ) => {
      ele.imageUrls = await Promise.all( ele.imageUrls.map( async ( image ) => {
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          file_path: image,
        };
        image = await signedUrl( params );
        return image;
      } ) );
      return ele;
    } ) );
    return res.sendSuccess( vmDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getVmTypeList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function deleteVmImage( req, res ) {
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

export async function deleteVmType( req, res ) {
  try {
    let vmDetails = await vmTypeService.findOne( { _id: req.body.vmId } );
    if ( !vmDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    await vmTypeService.deleteOne( { _id: req.body.vmId } );
    return res.sendSuccess( 'Vm type is deleted successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'deleteVmType', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getBrandList( req, res ) {
  try {
    let getBrandDetails = await planoProductService.find( { clientId: req.query.clientId } );
    return res.sendSuccess( getBrandDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getBrandList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function addUpdateBrandList( req, res ) {
  try {
    let inputData = req.body;
    let checkBrandExists = await planoProductService.findOne( { brandName: inputData.brandName.trim(), ...( inputData?.brandId ) ? { _id: { $ne: req.params._id } } : {} } );
    if ( checkBrandExists ) {
      return res.sendError( 'Brand Name already Exists' );
    }
    inputData.brandName = inputData.brandName.trim();
    await planoProductService.updateOne( { clientId: inputData.clientId, ...( inputData?.brandId ) ? { _id: { $ne: req.params._id } } : { brandName: inputData.brandName } }, inputData );
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
      if ( !acc[brandName] ) {
        acc[brandName] = {
          brandName: ele.brandName,
          clientId: inputData.clientId,
          brandCategoryDetails: [
            {
              subBrandName: ele.subBrandName,
              category: ele.category,
              subCategory: ele.subCategory,
            },
          ],
        };
      } else {
        acc[brandName].brandCategoryDetails.push( {
          subBrandName: ele.subBrandName,
          category: ele.category,
          subCategory: ele.subCategory,
        } );
      }
      return acc;
    }, {} );

    await Promise.all( Object.keys( brandData ).map( async ( ele ) => {
      await planoProductService.updateOne( { brandName: ele.brandName, clientId: req.body.clientId }, brandData[ele] );
    } ) );
    return res.sendSuccess( 'Brand details upload successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'uploadBrandList', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateTaskConfig( req, res ) {
  try {
    let inputData = req.body;
    inputData.type = 'task';
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
    if ( req.body?.vmImageUrl && ( req.body?.vmImageUrl.startsWith( 'https://' ) || req.body?.vmImageUrl.startsWith( 'http://' ) ) ) {
      req.body.vmImageUrl = req.body?.vmImageUrl.split( '?' )?.[0]?.split( '/' );
      req.body.vmImageUrl.splice( 0, 3 );
      req.body.vmImageUrl = decodeURIComponent( req.body.vmImageUrl.join( '/' ) );
    }
    await vmService.updateOne( { clientId: req.body.clientId, ...( req.body._id ) ? { _id: req.body._id } : { vmName: req.body.vmName } }, req.body );
    let message = req.body?._id ? 'updated' : 'added';
    return res.sendSuccess( `Vm data ${message} successfully` );
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
                  $in: [ '$$libraryId', '$vmConfig.vmId' ],
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
          vmSubBrand: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
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
                  $in: [ '$$libraryId', '$vmConfig.vmId' ],
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
          vmSubBrand: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
          templateId: 1,
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
          vmName: 1,
          vmType: 1,
          vmBrand: 1,
          vmCategory: 1,
          vmSubBrand: 1,
          clientId: 1,
          vmHeight: 1,
          status: 1,
          vmWidth: 1,
          vmImageUrl: 1,
          isDoubleSided: 1,
          templateId: 1,
          planoId: 1,
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
    if ( !fixtureDetails[0]?.fixtureData.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let result = {
      count: fixtureDetails[0].count[0].total,
      data: fixtureDetails[0].fixtureData,
    };
    result.data = await Promise.all( result.data.map( async ( ele ) => {
      if ( ele.vmImageUrl ) {
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          file_path: ele.vmImageUrl,
        };
        ele.vmImageUrl = await signedUrl( params );
      }
      return ele;
    } ) );
    if ( !req.body.export ) {
      return res.sendSuccess( result );
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet( 'Fixture Library' );

      sheet.getRow( 1 ).values = [ 'VM Name', 'VM Type', 'VM Brand', 'VM Category', 'VM SubBrand', 'VM Height(mm)', 'VM Width(mm)', 'VM ImageUrl', 'isDoubleSided' ];

      let rowStart = 2;
      let lockedRowNumber = [];

      if ( req.body.emptyDownload ) {
        result.data = [];
      }
      for ( let i=0; i<result.data.length; i++ ) {
        let height = 0;
        let width = 0;
        if ( result.data[i]?.vmHeight ) {
          height = result.data[i].vmHeight.value;
        }
        if ( result.data[i]?.vmWidth ) {
          width = result.data[i].vmWidth.value;
        }
        sheet.getRow( rowStart ).values = [ result.data[i]?.vmName || '', result.data[i]?.vmType || '', result.data[i]?.vmBrand || '', result.data[i]?.vmCategory, result.data[i]?.vmSubBrand, height, width, result.data[i]?.vmImageUrl || '', result.data[i].isDoubleSided ];
        if ( result.data[i].status != 'draft' ) {
          lockedRowNumber.push( rowStart );
        }
        rowStart = rowStart + 1;
      }

      let unlockCellValues = 20000;
      let splitLoop = [];

      for ( let i=1; i<=unlockCellValues; i+=2000 ) {
        splitLoop.push( { start: i, end: i + 1999 } );
      }

      await Promise.all( splitLoop.map( ( item ) => {
        for ( let i=item.start; i<=item.end; i++ ) {
          const row = sheet.getRow( i );
          if ( i > rowStart - 1 ) {
            row.values = [ '', '', '', '', '', '', '', '', '' ];
          }
          if ( !lockedRowNumber.includes( i ) && i != 1 ) {
            row.eachCell( ( cell ) => {
              cell.protection = { locked: false };
            } );
          }
        }
      } ) );

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
    let vmDetails = await vmService.findOne( { _id: req.body?.vmId } );
    if ( !vmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    vmDetails = vmDetails.toObject();
    delete vmDetails._id;
    let getAllLibraryList = await vmService.findAndSort( { vmName: { $regex: vmDetails.vmName.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), $options: 'i' } }, { vmName: 1 }, { vmName: -1 } );
    let counter = 1;
    let newFixName = vmDetails.vmName + ` (${counter})`;
    if ( getAllLibraryList?.length ) {
      let vmNameList = getAllLibraryList.map( ( ele ) => ele.vmName );
      while ( vmNameList.includes( newFixName ) ) {
        newFixName = vmDetails.vmName + ` (${counter})`;
        counter++;
      }
    }
    vmDetails.vmName = newFixName;
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
      return res.sendError( 'Vm id i required', 400 );
    }
    let getVmDetails = await vmService.findOne( { _id: req.query.vmId } );
    if ( !getVmDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let templateDetails = await fixtureTemplateService.findOne( { 'vmConfig.vmId': { $in: req.query.vmId } } );
    if ( templateDetails && getVmDetails.status != 'draft' ) {
      getVmDetails.status = 'inactive';
    }
    let fixtureDetails = await storeFixtureService.find( { 'vmConfig.vmId': { $in: req.query.vmId } }, { planoId: 1 } );
    if ( fixtureDetails.length ) {
      let planoList = fixtureDetails.map( ( ele ) => ele.planoId );
      let planoDetails = await planoService.find( { _id: { $in: planoList } }, { status: 1 } );
      planoDetails = planoDetails.map( ( ele ) => ele.status );
      if ( planoDetails.includes( 'completed' ) ) {
        getVmDetails.status = 'active';
      }
    }
    return res.sendSuccess( getVmDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getVmDetails', error: e } );
    return res.sendError( e, 500 );
  }
}
