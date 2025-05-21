import { logger } from 'tango-app-api-middleware';
import * as fixtureConfigService from '../service/fixtureConfig.service.js';
import * as fixtureLibService from '../service/planoLibrary.service.js';
import * as storeFixtureService from '../service/storeFixture.service.js';
import * as planoService from '../service/planogram.service.js';
import * as storeService from '../service/store.service.js';
import mongoose from 'mongoose';
const ObjectId = mongoose.Types.ObjectId;


export async function createTemplate( req, res ) {
  try {
    let inputData = req.body;
    let getLibDetails = await fixtureLibService.findOne( { _id: inputData.fixtureLibraryId, clientId: inputData.clientId } );
    if ( !getLibDetails ) {
      return res.sendError( 'Fixture library id is wrong', 400 );
    }
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
    await fixtureConfigService.updateOne( { _id: req.params.templateId }, inputData );
    return res.sendSuccess( 'Fixture template details updated successfullys' );
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
    let getFixtureDetails = await storeFixtureService.find( { fixureConfigId: req.body.templateId }, { _id: 1, planoId: 1 } );
    if ( getFixtureDetails.length ) {
      let planoDetails = await planoService.find( { _id: getFixtureDetails.map( ( ele ) => ele.planoId ) } );
      return res.sendError( `Fixture template is mapped with ${planoDetails.length}` );
    }
    await fixtureConfigService.deleteOne( { _id: req.body.templateId } );
    return res.sendSuccess( 'Fixture template deleted successfully' );
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
    console.log( duplicateDetails );
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
    let mappedStoreList = await storeFixtureService.aggregate( query );
    let storeList = mappedStoreList?.[0]?.store || [];
    let storeDetails = await storeService.find( { clientId: templateDetails.clientId, storeName: { $in: storeList } }, { storeName: 1, storeId: 1, spocDetails: 1 } );
    let data = {
      ...templateDetails.toObject(),
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
      { productBrandName: { $in: req.body.filter.brand } } :
      {} ),
      ...( req.body?.filter?.category?.length ?
      { productCategory: { $in: req.body.filter.category } } :
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
    if ( !req.body.export ) {
      return res.sendSuccess( result );
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet( 'Fixture Template' );

      sheet.getRow( 1 ).values = [ 'VM Lib Code', 'VM Name', 'VM Type', 'VM Brand', 'VM SubBrand', 'VM Category', 'VM Subcategory', 'VM Height(mm)', 'VM Width(mm)', 'VM ImageUrl', 'isDoubleSided' ];

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
        sheet.getRow( rowStart ).values = [ result.data[i]?.vmLibCode || '', result.data[i]?.vmName || '', result.data[i]?.vmType || '', result.data[i]?.vmBrand || '', result.data[i]?.vmSubBrand || '', result.data[i]?.vmCategory || '', result.data[i]?.vmSubCategory ||'', height, width, result.data[i]?.vmImageUrl || '', result.data[i].isDoubleSided || '' ];
        if ( result.data[i].templateId.length || result.data[i].status == 'active' ) {
          lockedRowNumber.push( rowStart );
        }
        rowStart = rowStart + 1;
      }

      let productBrandDetails = await planoProductService.find( { clientId: req.body.clientId } );
      let vmTypeList = await vmTypeService.find( { clientId: req.body.clientId } );
      vmTypeList = vmTypeList.map( ( ele ) => ele.vmType );
      let brand = productBrandDetails.map( ( ele ) => ele.brandName );
      let brandSubBrand = [ ...new Set( productBrandDetails.flatMap( ( ele ) => ele.brandDetails.map( ( brand ) => brand.subBrandName ) ) ) ];
      let brandCategories = productBrandDetails.flatMap( ( ele ) => ele.brandDetails.flatMap( ( brand ) => [ ...brand.category ] ) );
      let brandSubCategories = productBrandDetails.flatMap( ( ele ) => ele.brandDetails.flatMap( ( brand ) => [ ...brand.subCategory ] ) );
      brandCategories = [ ...new Set( brandCategories.map( ( ele ) => ele ) ) ];
      brandSubCategories = [ ...new Set( brandSubCategories.map( ( ele ) => ele ) ) ];

      const maxRows = 1048576;

      let dropDownRange = [ { key: `C2:C${maxRows}`, optionList: [ `"${vmTypeList.toString()}"` ] }, { key: `D2:D${maxRows}`, optionList: [ `"${brand.toString()}"` ] }, { key: `E2:E${maxRows}`, optionList: [ `"${brandSubBrand.toString()}"` ] }, { key: `F2:F${maxRows}`, optionList: [ `"${brandCategories.toString()}"` ] }, { key: `G2:G${maxRows}`, optionList: [ `"${brandSubCategories.toString()}"` ] } ];

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
              const columnLetter = cell.address.replace( /[0-9]/g, '' );
              if ( columnLetter != 'A' ) {
                cell.protection = { locked: false };
              }
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
    logger.error( { functionName: 'getTemplateList', error: e } );
    return res.sendError( e, 500 );
  }
}
