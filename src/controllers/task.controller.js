import * as taskService from '../service/task.service.js';
import * as processedService from '../service/processedTaskservice.js';
import * as storeService from '../service/store.service.js';
import * as processedChecklistService from '../service/processedchecklist.service.js';
import * as userService from '../service/user.service.js';
import dayjs from 'dayjs';
import { logger, fileUpload, signedUrl } from 'tango-app-api-middleware';
import * as planoTaskService from '../service/planoTask.service.js';
import * as planoService from '../service/planogram.service.js';
import * as checklistService from '../service/checklist.service.js';
import timeZone from 'dayjs/plugin/timezone.js';
import * as planoProductService from '../service/planoProduct.service.js';
import mongoose from 'mongoose';
// const ObjectId = mongoose.Types.ObjectId;
import * as floorService from '../service/storeBuilder.service.js';
import * as planoStaticService from '../service/planoStaticData.service.js';

dayjs.extend( timeZone );

async function createUser( data ) {
  try {
    let params = {
      userName: data.userName,
      email: data.email,
      mobileNumber: data?.mobileNumber || '',
      clientId: data.clientId,
      role: 'user',
      password: '5dqFKAJj29PsV6P+kL+3Dw==',
      isActive: true,
      userType: 'client',
      rolespermission: [
        {
          featureName: 'Global',
          modules: [
            {
              name: 'Store',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'User',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'Camera',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'Configuration',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'Subscription',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'Billing',
              isAdd: false,
              isEdit: false,

            },
          ],
        },
        {
          featurName: 'TangoEye',
          modules: [
            {
              name: 'ZoneTag',
              isAdd: false,
              isEdit: false,

            },
          ],
        },
        {
          featurName: 'TangoTrax',
          modules: [
            {
              name: 'checklist',
              isAdd: false,
              isEdit: false,

            },
            {
              name: 'Task',
              isAdd: false,
              isEdit: false,

            },
          ],
        },
      ],
    };
    let response = await userService.create( params );
    return response;
  } catch ( e ) {
    logger.error( 'createUser =>', e );
    return false;
  }
}

export async function createTask( req, res ) {
  try {
    let taskDetails = await taskService.find( { isPlano: true, client_id: req.body.clientId, ...( req.body.checkListName )? { checkListName: req.body.checkListName } : {} } );
    let storeList = req.body.stores.map( ( ele ) => ele.store.toLowerCase() );
    let userDetails;
    if ( !taskDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }
    let endDate;
    let scheduleEndTime = '11:59 PM';
    let taskConfig = await planoStaticService.findOne( { clientId: req.body.clientId, type: 'task' } );
    if ( taskConfig && !req.body?.endTime ) {
      scheduleEndTime = taskConfig?.dueTime || '11:59 PM';
      req.body.days = taskConfig?.dueDay || 1;
      req.body.geoFencing = taskConfig?.allowedStoreLocation || false;
    }
    if ( req.body?.endTime ) {
      scheduleEndTime = req.body.endTime;
    }
    endDate = dayjs().add( req.body.days, 'day' ).format( 'YYYY-MM-DD' );
    let userEmailList = [ ...new Set( req.body.stores.map( ( ele ) => ele.email ) ) ];
    for ( let mail of userEmailList ) {
      let query = [
        {
          $addFields: {
            emailLower: { $toLower: '$email' },
          },
        },
        {
          $match: {
            clientId: req.body.clientId,
            emailLower: mail.toLowerCase(),
          },
        },
      ];
      userDetails = await userService.aggregate( query );
      if ( !userDetails.length ) {
        let userData = {
          clientId: req.body.clientId,
          mobileNumber: '',
          email: mail,
          userName: mail.split( '@' )[0],
        };
        await createUser( userData );
      }
    }
    endDate = `${endDate} ${scheduleEndTime}`;
    await Promise.all( taskDetails.map( async ( task ) => {
      let splitName = task?.checkListName.split( ' ' );
      splitName.pop();
      let data = {
        client_id: req.body.clientId,
        date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
        date_string: dayjs().format( 'YYYY-MM-DD' ),
        sourceCheckList_id: task._id,
        checkListName: task.checkListName,
        checkListId: task._id,
        scheduleStartTime: '12:00 AM',
        scheduleEndTime: scheduleEndTime,
        scheduleStartTime_iso: dayjs.utc( '12:00 AM', 'hh:mm A' ).format(),
        scheduleEndTime_iso: dayjs.utc( endDate, 'YYYY-MM-DD hh:mm A' ).format(),
        allowedOverTime: false,
        allowedStoreLocation: req.body?.geoFencing || false,
        createdBy: task.createdBy,
        createdByName: task.createdByName,
        questionAnswers: [],
        isdeleted: false,
        questionCount: 0,
        storeCount: 0,
        locationCount: 0,
        checkListType: 'task',
        country: '',
        store_id: '',
        storeName: '',
        userId: '',
        userName: '',
        userEmail: '',
        checklistStatus: 'open',
        timeFlagStatus: true,
        timeFlag: 0,
        questionFlag: 0,
        mobileDetectionFlag: 0,
        storeOpenCloseFlag: 0,
        reinitiateStatus: false,
        markasread: false,
        uniformDetectionFlag: 0,
        scheduleRepeatedType: 'daily',
        approvalStatus: false,
        approvalEnable: false,
        redoStatus: false,
        isPlano: true,
        planoType: splitName.length == 1 ? splitName[0].toLowerCase() : splitName[0].toLowerCase() + splitName[2],
      };
      let query = [
        {
          $addFields: {
            store: { $toLower: '$storeName' },
          },
        },
        {
          $match: {
            clientId: req.body.clientId,
            store: { $in: storeList },
          },
        },
      ];

      let storeDetails = await storeService.aggregate( query );
      await Promise.all( storeDetails.map( async ( store ) => {
        let getUserEmail = req.body.stores.find( ( ele ) => ele.store.toLowerCase() == store.storeName.toLowerCase() );
        let planoDetails = await planoService.findOne( { storeName: store.storeName } );
        if ( planoDetails ) {
          let floorDetails = await floorService.find( { planoId: planoDetails._id }, { _id: 1, floorName: 1 } );
          for ( let i=0; i<floorDetails.length; i++ ) {
            if ( getUserEmail ) {
              let query = [
                {
                  $addFields: {
                    emailLower: { $toLower: '$email' },
                  },
                },
                {
                  $match: {
                    clientId: req.body.clientId,
                    emailLower: getUserEmail.email.toLowerCase(),
                  },
                },
              ];
              userDetails = await userService.aggregate( query );
              userDetails = userDetails[0];
            }
            let taskData = { ...data };
            if ( floorDetails.length > 1 ) {
              taskData.checkListName = taskData.checkListName +' - '+ floorDetails[i].floorName;
            }
            taskData.floorId = floorDetails[i]._id;
            taskData.store_id = store.storeId;
            taskData.storeName = store.storeName;
            taskData.userId = userDetails._id;
            taskData.userName = userDetails.userName;
            taskData.userEmail = userDetails.email;
            taskData.planoId = planoDetails?._id;
            for ( let i=0; i<req.body.days; i++ ) {
              let currDate = dayjs().add( i, 'day' );
              let insertData = { ...taskData, date_string: currDate.format( 'YYYY-MM-DD' ), date_iso: new Date( currDate.format( 'YYYY-MM-DD' ) ), scheduleStartTime_iso: dayjs.utc( `${currDate.format( 'YYYY-MM-DD' )} 12:00 AM`, 'YYYY-MM-DD hh:mm A' ).format() };
              await processedService.updateOne( { date_string: currDate.format( 'YYYY-MM-DD' ), store_id: insertData.store_id, userEmail: insertData.userEmail, planoId: insertData.planoId, sourceCheckList_id: task._id, ...( taskData?.floorId ) ? { floorId: taskData.floorId }:{} }, insertData );
            }
          }
        }
      } ) );
    } ) );

    return res.sendSuccess( 'Task created successfully' );
  } catch ( e ) {
    console.log( e );
    logger.error( { functionName: 'createTask', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function createPlano( req, res ) {
  try {
    let checklistDetails = await checklistService.find( { isPlano: true, client_id: req.body.clientId } );
    let storeList = req.body.stores.map( ( ele ) => ele.store.toLowerCase() );
    let userDetails;
    if ( !checklistDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }
    await Promise.all( checklistDetails.map( async ( checklist ) => {
      let data = {
        client_id: req.body.clientId,
        date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
        date_string: dayjs().format( 'YYYY-MM-DD' ),
        sourceCheckList_id: checklist._id,
        checkListName: checklist.checkListName,
        checkListId: checklist._id,
        scheduleStartTime: '08:00 AM',
        scheduleEndTime: '11:59 PM',
        scheduleStartTime_iso: dayjs.utc( '08:00 AM', 'hh:mm A' ).format(),
        scheduleEndTime_iso: dayjs.utc( '11:59 PM', 'hh:mm A' ).format(),
        allowedOverTime: false,
        allowedStoreLocation: false,
        createdBy: checklist.createdBy,
        createdByName: checklist.createdByName,
        questionAnswers: [],
        isdeleted: false,
        questionCount: 0,
        storeCount: 0,
        locationCount: 0,
        checkListType: 'custom',
        country: '',
        store_id: '',
        storeName: '',
        userId: '',
        userName: '',
        userEmail: '',
        checklistStatus: 'open',
        timeFlagStatus: true,
        timeFlag: 0,
        questionFlag: 0,
        mobileDetectionFlag: 0,
        storeOpenCloseFlag: 0,
        reinitiateStatus: false,
        markasread: false,
        uniformDetectionFlag: 0,
        scheduleRepeatedType: 'daily',
        approvalStatus: false,
        approvalEnable: false,
        redoStatus: false,
        isPlano: true,
        planoType: checklist.checkListName == 'Planogram QR' ? 'qr' : 'rfid',
      };
      let query = [
        {
          $addFields: {
            store: { $toLower: '$storeName' },
          },
        },
        {
          $match: {
            clientId: req.body.clientId,
            store: { $in: storeList },
          },
        },
      ];

      let storeDetails = await storeService.aggregate( query );
      await Promise.all( storeDetails.map( async ( store ) => {
        let getUserEmail = req.body.stores.find( ( ele ) => ele.store.toLowerCase() == store.storeName.toLowerCase() );
        let planoDetails = await planoService.findOne( { storeId: store.storeId } );
        if ( getUserEmail ) {
          let query = [
            {
              $addFields: {
                emailLower: { $toLower: '$email' },
              },
            },
            {
              $match: {
                clientId: req.body.clientId,
                email: getUserEmail.email,
              },
            },
          ];
          userDetails = await userService.aggregate( query );
          console.log( userDetails );
          if ( !userDetails.length ) {
            let userData = {
              clientId: req.body.clientId,
              mobileNumber: '',
              email: getUserEmail.email,
              userName: getUserEmail.email.split( '@' )[0],
            };
            userDetails = await createUser( userData );
          } else {
            userDetails = userDetails[0];
          }
        }
        let checklistData = { ...data };
        checklistData.store_id = store.storeId;
        checklistData.storeName = store.storeName;
        checklistData.userId = userDetails._id;
        checklistData.userName = userDetails.userName;
        checklistData.userEmail = userDetails.email;
        checklistData.planoId = planoDetails?._id;
        for ( let i=0; i<req.body.days; i++ ) {
          let currDate = dayjs().add( i, 'day' );
          let insertData = { ...checklistData, date_string: currDate.format( 'YYYY-MM-DD' ), date_iso: new Date( currDate.format( 'YYYY-MM-DD' ) ), scheduleStartTime_iso: dayjs.utc( `${currDate.format( 'YYYY-MM-DD' )} 08:00 AM`, 'YYYY-MM-DD hh:mm A' ).format(), scheduleEndTime_iso: dayjs.utc( `${currDate.format( 'YYYY-MM-DD' )} 11:59 PM`, 'YYYY-MM-DD hh:mm A' ).format() };
          let response = await processedChecklistService.updateOne( { date_string: currDate.format( 'YYYY-MM-DD' ), store_id: insertData.store_id, userEmail: insertData.userEmail, planoId: insertData.planoId, sourceCheckList_id: checklist._id }, insertData );
          console.log( insertData.store_id, response );
        }
      } ) );
    } ) );

    return res.sendSuccess( 'Checklist created successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'createTask', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getTaskDetails( req, res ) {
  try {
    if ( !req.query.storeId ) {
      return res.sendError( 'Store id is required', 400 );
    }
    // let date = req.query?.date || dayjs().format( 'YYYY-MM-DD' );
    // let getDetails = await processedService.find( { store_id: req.query.storeId, date_string: date, isPlano: true, checklistStatus: { $ne: 'submit' }, userId: req.user._id }, { checkListName: 1, taskType: '$planoType', checklistStatus: 1 } );
    return res.sendSuccess( [] );
  } catch ( e ) {
    logger.error( { functionName: 'getTaskDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function uploadImage( req, res ) {
  try {
    if ( !req.body.taskId ) {
      return res.sendError( 'task id is required', 400 );
    }
    if ( !req.body.qno ) {
      return res.sendError( 'Qno is required', 400 );
    }
    if ( !req.files.file ) {
      return res.sendError( 'Please upload a file', 400 );
    }

    let params = {
      Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
      Key: `${req.body.taskId}/${req.body.qno}/${Date.now()}/`,
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
      return res.sendSuccess( { url: imageUrl, path: fileRes.Key } );
    }
    return res.sendError( 'Something went wrong', 500 );
  } catch ( e ) {
    logger.error( { functionName: 'uploadImage', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateStatus( req, res ) {
  try {
    if ( !req.body.taskId ) {
      return res.sendError( 'No data found', 204 );
    }
    if ( !req.body.status ) {
      return res.sendError( 'Status is required', 400 );
    }
    let taskDetails = await processedService.findOne( { _id: req.body.taskId } );
    if ( !taskDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    let storeTimeZone = await storeService.findOne( { storeName: { $regex: taskDetails.storeName, $options: 'i' }, clientId: taskDetails.client_id }, { 'storeProfile.timeZone': 1 } );
    let currentDateTime;
    if ( storeTimeZone?.storeProfile?.timeZone ) {
      currentDateTime = dayjs().tz( storeTimeZone?.storeProfile?.timeZone );
    } else {
      currentDateTime = requestData?.currentTime ? dayjs( requestData.currentTime, 'HH:mm:ss' ) : dayjs();
    }
    let timeString = currentDateTime.format( 'hh:mm A, DD MMM YYYY' );
    let comments = {
      userId: req.user._id,
      userName: req.user.Name,
      email: req.user.email,
      comment: req.body.comments,
    };
    await processedService.updateOne( { _id: req.body.taskId }, { checklistStatus: req.body.status, ...( req.body.status == 'inprogress' ) ? { startTime_string: timeString } : { submitTime_string: timeString }, comments: { $push: comments } } );
    if ( req.body.status == 'submit' ) {
      await processedService.deleteMany( { planoId: taskDetails.planoId, userEmail: taskDetails.userEmail, store_id: taskDetails.store_id, ...( taskDetails?.floorId ) ? { floorId: taskDetails.floorId } : {}, date_iso: { $gt: new Date( dayjs().format( 'YYYY-MM-DD' ) ) } } );
    }
    return res.sendSuccess( 'Task status updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'storeLayout', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateAnswers( req, res ) {
  try {
    req.body.answers.forEach( ( ans ) => {
      if ( ans?.correctedFixture?.length ) {
        ans.correctedFixture.forEach( ( fixture ) => {
          if ( fixture.image ) {
            fixture.image = fixture.image.split( '.com/' )[1].split( '?' )[0];
            fixture.image = decodeURIComponent( fixture.image );
          }
          if ( fixture.video ) {
            fixture.video = fixture.video.split( '.com/' )[1].split( '?' )[0];
            fixture.video = decodeURIComponent( fixture.video );
          }
        } );
      }
      if ( ans.image ) {
        ans.image = ans.image.split( '.com/' )[1].split( '?' )[0];
        ans.image = decodeURIComponent( ans.image );
      }
      if ( ans.video ) {
        ans.video = ans.video.split( '.com/' )[1].split( '?' )[0];
        ans.video = decodeURIComponent( ans.video );
      }
      if ( ans?.newVms?.length ) {
        ans.newVms.forEach( ( vms ) => {
          if ( vms?.imageUrl ) {
            vms.imageUrl = vms.imageUrl.split( '.com/' )[1].split( '?' )[0];
            vms.imageUrl = decodeURIComponent( vms.imageUrl );
          }
          if ( vms?.video ) {
            vms.video = vms.video.split( '.com/' )[1].split( '?' )[0];
            vms.video = decodeURIComponent( vms.video );
          }
        } );
      }
    } );

    let taskDetails = await processedService.findOne( { date_string: dayjs().format( 'YYYY-MM-DD' ), userId: req.user._id, isPlano: true,
      planoType: req.body.type, planoId: new mongoose.Types.ObjectId( req.body.planoId ), floorId: new mongoose.Types.ObjectId( req.body.floorId ) } );


    let data = {
      fixtureId: req.body.fixtureId,
      answers: req.body.answers,
      status: req.body.answers?.find( ( ans ) => typeof ans.value == 'boolean' && ans?.value == false ) ? 'incomplete' : 'complete',
      planoId: req.body.planoId,
      floorId: req.body.floorId,
      type: req.body.type,
      date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
      taskId: taskDetails?._id,
      storeName: taskDetails?.storeName,
    };

    await planoTaskService.updateOne( { planoId: req.body.planoId, floorId: req.body.floorId, fixtureId: req.body.fixtureId, type: req.body.type, date_string: dayjs().format( 'YYYY-MM-DD' ), ...( taskDetails?._id ) ? { taskId: taskDetails?._id } :{} }, data );
    return res.sendSuccess( 'Fixture details updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateAnswers', error: e } );
    return res.sendError( e, 500 );
  }
}
export async function updateAnswersv2( req, res ) {
  try {
    let taskDetails = await processedService.findOne( { _id: new mongoose.Types.ObjectId( req.body.taskId ) } );
    console.log( taskDetails );
    if ( !taskDetails ) {
      return res.sendError( 'No data found', 204 );
    }

    let data = {
      fixtureId: req.body.fixtureId,
      answers: req.body.answers,
      status: req.body.status,
      planoId: req.body.planoId,
      floorId: req.body.floorId,
      type: req.body.type,
      date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
      taskId: req.body.taskId,
      storeName: req.body?.storeName,
      storeId: req.body?.storeId,
    };
    console.log( data );
    await planoTaskService.updateOne( { planoId: req.body.planoId, floorId: req.body.floorId, fixtureId: req.body.fixtureId, type: req.body.type, date_string: dayjs().format( 'YYYY-MM-DD' ), ...( taskDetails?._id ) ? { taskId: taskDetails?._id } :{} }, data );

    return res.sendSuccess( 'Fixture details updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'updateAnswers', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function getFixtureDetails( req, res ) {
  try {
    if ( !req.query.fixtureId && !req.query.planoId ) {
      return res.sendError( 'Fixture/Plano id is required', 400 );
    }
    let query = { type: req.query.type };
    if ( req.query?.fixtureId ) {
      query['fixtureId'] = req.query.fixtureId;
    } else {
      if ( !req.query.floorId ) {
        return res.sendError( 'Floor id is required', 400 );
      }
      query['planoId'] = req.query.planoId;
      query['floorId'] = req.query.floorId;
    }

    if ( req.query?.date ) {
      query['date_string'] = req.query?.date;
    }
    let fixtureDetails = await planoTaskService.findOne( query );
    if ( !fixtureDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    fixtureDetails = await Promise.all( fixtureDetails.answers.map( async ( ans ) => {
      if ( ans?.correctedFixture?.length ) {
        for ( let fixture of ans.correctedFixture ) {
          if ( fixture.image ) {
            let params = {
              Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
              file_path: fixture.image,
            };
            fixture.image = await signedUrl( params );
          }
          if ( fixture.video ) {
            let params = {
              Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
              file_path: fixture.video,
            };
            fixture.video = await signedUrl( params );
          }
        }
      }
      if ( ans?.newVms?.length ) {
        for ( let fixture of ans.newVms ) {
          if ( fixture.imageUrl ) {
            let params = {
              Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
              file_path: fixture.imageUrl,
            };
            fixture.imageUrl = await signedUrl( params );
          }
          if ( fixture.video ) {
            let params = {
              Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
              file_path: fixture.video,
            };
            fixture.video = await signedUrl( params );
          }
        }
      }
      if ( ans.image ) {
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          file_path: ans.image,
        };
        let imageUrl = await signedUrl( params );
        ans.image = imageUrl;
      }
      if ( ans.video ) {
        let params = {
          Bucket: JSON.parse( process.env.BUCKET ).storeBuilder,
          file_path: ans.video,
        };
        let imageUrl = await signedUrl( params );
        ans.video = imageUrl;
      }
      return ans;
    } ) );

    return res.sendSuccess( fixtureDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getFixtureDetails', error: 'e' } );
    return res.sendError( e, 500 );
  }
}

export async function getVmDetails( req, res ) {
  try {
    let getVms = await planoProductService.find( { type: 'vm', productName: { $ne: ' ' } }, { productName: 1 } );
    if ( !getVms.length ) {
      return res.sendError( 'No data found', 204 );
    }
    getVms = [ ...new Set( getVms.map( ( ele ) => ele.productName ) ) ];
    getVms.push( 'other' );
    return res.sendSuccess( getVms );
  } catch ( e ) {
    logger.error( { functionName: 'getVmDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function generatetaskDetails( req, res ) {
  try {
    let query =[
      {
        $match: {
          date_iso: { $gte: new Date( req.body.fromDate ), $lte: new Date( req.body.toDate ) },
          isPlano: true,
          planoType: 'layout',
          ...( req.body?.store?.length ) ? { storeName: { $in: req.body.store } } :{},
          userEmail: { $nin: [ 'sandeep.pal@yopmail.com', 'balaji@tangotech.co.in', 'gowri@tangotech.co.in', 'gowri@yopmail.com' ] },
        },
      },
      // {
      //   $lookup: {
      //     from: '$planogram',
      //     let: { plano: '$planoId' },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $and: {
      //               $eq: [ '$_id', '$$plano' ],
      //             },
      //           },
      //         },
      //       },
      //     ],
      //     as: 'planogram',
      //   },
      // },
      // {
      //   $lookup: {
      //     from: 'checklistassignconfigs',
      //     let: { storeId: '$store_id', email: '$userEmail' },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $and: [
      //               // { $eq: [ '$checkListId', new ObjectId( '6789e3c7a5683c58215ec089' ) ] },
      //               { $eq: [ '$store_id', '$$storeId' ] },
      //               { $eq: [ '$userEmail', '$$email' ] },
      //             ],
      //           },
      //         },
      //       },
      //     ],
      //     as: 'assignUser',
      //   },
      // },
      {
        $project: {
          _id: 1,
          storeName: 1,
          store_id: 1,
          userEmail: 1,
          planoId: 1,
          checklistStatus: 1,
          date_string: 1,
          storeStatus: {
            $cond: {
              if: { $eq: [ '$checklistStatus', 'submit' ] },
              then: '',
              else: '',

            },
          },
        },
      },
      {
        $group: {
          _id: '$storeName',
          count: { $sum: 1 },
          planoId: { $last: '$planoId' },
          taskId: { $push: '$_id' },
          checklistStatus: { $last: '$checklistStatus' },
          date_string: { $push: '$date_string' },
        },
      },
      {
        $project: {
          _id: 0,
          taskId: 1,
          planoId: 1,
          checklistStatus: 1,
          count: 1,
          date_string: 1,
          storeName: '$_id',
        },
      },
    ];
    let taskDetails = await processedService.aggregate( query );
    console.log( taskDetails.flatMap( ( ele ) => ele.taskId ) );
    // ...( req.body.store.length ) ? { storeName: { $in: req.body.store } } : {}, taskId: { $in: taskDetails.flatMap( ( ele ) => ele.taskId ) } },
    let processedTaskDetails = await planoTaskService.find( { date_string: { $gte: req.body.fromDate, $lte: req.body.toDate }, type: 'layout' }, { status: 1, planoId: 1, date_string: 1, _id: 0, taskId: 1 } );
    console.log( processedTaskDetails.length );

    processedTaskDetails = await Promise.all( processedTaskDetails.map( async ( ele ) => {
      ele = { ...ele.toObject(), storeName: '' };
      if ( ele.planoId ) {
        let planoDetails = await planoService.findOne( { _id: ele.planoId }, { storeName: 1 } );
        console.log( planoDetails );
        if ( planoDetails ) {
          ele.storeName = planoDetails.storeName;
        }
      }
      return ele;
    } ) );

    processedTaskDetails.forEach( ( item ) => {
      let taskIndex = taskDetails.findIndex( ( taskItem ) => taskItem.checklistStatus =='submit' && taskItem.date_string.includes( item.date_string ) && item.planoId.toString() == taskItem.planoId.toString() );
      console.log( taskIndex, 'index' );
      if ( taskIndex != -1 ) {
        taskDetails[taskIndex].storeStatus = item.status == 'complete' ? 'yes' : 'No';
      }
    } );

    taskDetails.forEach( ( ele ) => {
      delete ele.planoId;
    } );


    let completeStore = taskDetails.filter( ( ele ) => ele.checklistStatus.includes( 'submit' ) );
    completeStore = completeStore.reduce( ( acc, ele ) => {
      if ( !acc[ele.storeName] ) {
        acc[ele.storeName] = {
          storeName: ele.storeName,
          status: 'submit',
          storeStatus: ele.storeStatus,
        };
      }
      return acc;
    }, {} );

    completeStore = Object.values( completeStore );

    let completeStoreList =completeStore.map( ( item ) => item.storeName );

    let incompleteStore = taskDetails.filter( ( ele ) => !ele.checklistStatus.includes( 'submit' ) );

    incompleteStore = incompleteStore.reduce( ( acc, ele ) => {
      if ( !acc[ele.storeName] ) {
        acc[ele.storeName] = {
          storeName: ele.storeName,
          status: ele.checklistStatus[ele.checklistStatus.length - 1],
          storeStatus: ele.storeStatus,
        };
      }
      return acc;
    }, {} );

    incompleteStore = Object.values( incompleteStore );

    incompleteStore = incompleteStore.filter( ( ele ) => !completeStoreList.includes( ele.storeName ) );

    if ( !taskDetails.length ) {
      return res.sendError( 'No date found', 204 );
    }

    let data = [ ...completeStore, ...incompleteStore ];
    let yesCount = completeStore.filter( ( ele ) => ele.storeStatus == 'yes' );
    let noCount = completeStore.filter( ( ele ) => ele.storeStatus == 'No' );

    return res.sendSuccess( { count: data.length, completeStore: completeStore.length, incompleteStore: incompleteStore.length, yesCount: yesCount.length, noCount: noCount.length, data } );
  } catch ( e ) {
    console.log( e );
    logger.error( { functioName: 'generatetaskDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function taskSubmitDetails( req, res ) {
  try {
    let query = [
      {
        $match: {
          date_string: { $gte: req.body.fromDate, $lte: req.body.toDate },
          type: 'layout',
          status: req.body.status,
        },
      },
      {
        $group: {
          _id: '',
          planoId: { $addToSet: '$planoId' },
        },
      },
      {
        $lookup: {
          from: 'processedtasks',
          let: { plano_id: '$planoId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: [ '$planoId', '$$plano_id' ] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$planoId',
                storeName: { $first: '$storeName' },
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
          _id: 0,
          storeName: '$planogram.storeName',
        },
      },
    ];

    let processedTaskDetails = await planoTaskService.aggregate( query );
    processedTaskDetails = processedTaskDetails.map( ( ele ) => ele.storeName );
    return res.sendSuccess( { count: processedTaskDetails.length, data: processedTaskDetails } );
  } catch ( e ) {
    logger.error( { functioName: 'taskSubmitDetails', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function redoTask( req, res ) {
  try {
    if ( !req.body.taskId ) {
      return res.sendError( 'Task id is required', 400 );
    }
    let getTaskDetails = await processedService.findOne( { _id: req.body.taskId } );
    if ( !getTaskDetails ) {
      return res.sendError( e, 204 );
    }
    await processedService.updateOne( { _id: req.body.taskId }, { checklistStatus: 'open', redoStatus: true } );
    return res.sendSuccess( 'Task is republished successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'redoTask', error: e } );
    return res.sendError( e, 500 );
  }
}
