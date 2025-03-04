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
    let endDate = dayjs().add( req.body.days, 'day' ).format( 'YYYY-MM-DD' );
    await Promise.all( taskDetails.map( async ( task ) => {
      let data = {
        client_id: req.body.clientId,
        date_iso: new Date( dayjs().format( 'YYYY-MM-DD' ) ),
        date_string: dayjs().format( 'YYYY-MM-DD' ),
        sourceCheckList_id: task._id,
        checkListName: task.checkListName,
        checkListId: task._id,
        scheduleStartTime: '12:00 AM',
        scheduleEndTime: '11:59 PM',
        scheduleStartTime_iso: dayjs.utc( '12:00 AM', 'hh:mm A' ).format(),
        scheduleEndTime_iso: dayjs( endDate ).utc( '11:59 PM', 'hh:mm A' ).format(),
        allowedOverTime: false,
        allowedStoreLocation: false,
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
        planoType: task.checkListName == 'Product Verification' ? 'product' : task.checkListName == 'Fixture Verification' ? 'fixture' : task.checkListName == 'Layout Verification' ? 'layout' : 'vm',
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
        let taskData = { ...data };
        taskData.store_id = store.storeId;
        taskData.storeName = store.storeName;
        taskData.userId = userDetails._id;
        taskData.userName = userDetails.userName;
        taskData.userEmail = userDetails.email;
        taskData.planoId = planoDetails?._id;
        for ( let i=0; i<req.body.days; i++ ) {
          let currDate = dayjs().add( i, 'day' );
          let insertData = { ...taskData, date_string: currDate.format( 'YYYY-MM-DD' ), date_iso: new Date( currDate.format( 'YYYY-MM-DD' ) ), scheduleStartTime_iso: dayjs.utc( `${currDate.format( 'YYYY-MM-DD' )} 12:00 AM`, 'YYYY-MM-DD hh:mm A' ).format() };
          let response = await processedService.updateOne( { date_string: currDate.format( 'YYYY-MM-DD' ), store_id: insertData.store_id, userEmail: insertData.userEmail, planoId: insertData.planoId, sourceCheckList_id: task._id }, insertData );
          console.log( insertData.store_id, response );
        }
      } ) );
    } ) );

    return res.sendSuccess( 'Task created successfully' );
  } catch ( e ) {
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
    let date = req.query?.date || dayjs().format( 'YYYY-MM-DD' );
    let getDetails = await processedService.find( { store_id: req.query.storeId, date_string: date, isPlano: true, checklistStatus: { $ne: 'submit' } }, { checkListName: 1, taskType: '$planoType' } );
    return res.sendSuccess( getDetails );
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
    let submitTimeString = currentDateTime.format( 'hh:mm A, DD MMM YYYY' );
    await processedService.updateOne( { _id: req.body.taskId }, { checklistStatus: req.body.status, ...( req.body.status == 'inprogress' ) ? { startTime_string: submitTimeString } : { submitTime_string: submitTimeString } } );
    if ( req.body.status == 'submit' ) {
      await processedService.deleteMany( { _id: req.body.taskId, date_iso: { $gt: new Date( dayjs().format( 'YYYY-MM-DD' ) ) } } );
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
      if ( ans.image ) {
        ans.image = ans.image.split( '.com/' )[1].split( '?' )[0];
        ans.image = decodeURIComponent( ans.image );
      }
      if ( ans.video ) {
        ans.video = ans.video.split( '.com/' )[1].split( '?' )[0];
        ans.video = decodeURIComponent( ans.video );
      }
    } );

    let data = {
      fixtureId: req.body.fixtureId,
      answers: req.body.answers,
      status: req.body.answers?.find( ( ans ) => typeof ans.value == 'boolean' && ans?.value == false ) ? 'incomplete' : 'complete',
      planoId: req.body.planoId,
      floorId: req.body.floorId,
      type: req.body.type,
    };

    await planoTaskService.updateOne( { fixtureId: req.body.fixtureId, type: req.body.type }, data );
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

    let fixtureDetails = await planoTaskService.findOne( { fixtureId: req.query.fixtureId } );
    if ( !fixtureDetails ) {
      return res.sendError( 'No data found', 204 );
    }
    fixtureDetails = await Promise.all( fixtureDetails.answers.map( async ( ans ) => {
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
