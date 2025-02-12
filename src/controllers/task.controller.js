import * as taskService from '../service/task.service.js';
import * as processedService from '../service/processedchecklist.service.js';
import * as storeService from '../service/store.service.js';
import * as userService from '../service/user.service.js';
import dayjs from 'dayjs';
import { logger, fileUpload, signedUrl } from 'tango-app-api-middleware';
import * as planoTaskService from '../service/planoTask.service.js';
import * as planoService from '../service/planogram.service.js';

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
    let taskDetails = await taskService.find( { isPlano: true, client_id: req.body.clientId } );
    let storeList = req.body.stores.map( ( ele ) => ele.toLowerCase() );
    let userDetails;
    if ( !taskDetails.length ) {
      return res.sendError( 'No data found', 204 );
    }
    await Promise.all( taskDetails.map( async ( task ) => {
      let processedList = await processedService.findOne( { sourceCheckList_id: task._id, checklistStatus: 'submit' } );
      if ( !processedList ) {
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
          scheduleEndTime_iso: dayjs.utc( '11:59 PM', 'hh:mm A' ).format(),
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
        if ( req.body.userEmail ) {
          let query = [
            {
              $addFields: {
                emailLower: { $toLower: '$email' },
              },
            },
            {
              $match: {
                clientId: req.body.clientId,
                emailLower: req.body.userEmail,
              },
            },
          ];
          userDetails = await userService.aggregate( query );
          if ( !userDetails.length ) {
            let userData = {
              clientId: req.body.clientId,
              mobileNumber: '',
              email: req.body.userEmail,
              userName: req.body.userEmail.split( '@' )[0],
            };
            userDetails = await createUser( userData );
          } else {
            userDetails = userDetails[0];
          }
        }
        if ( !req.body.userEmail ) {
          await Promise.all( storeDetails.map( async ( store ) => {
            let planoDetails = await planoService.findOne( { storeId: store.storeId } );
            userDetails = await userService.findOne( { email: store?.spocDetails?.[0]?.email } );
            if ( !userDetails ) {
              let userData = {
                clientId: req.body.clientId,
                mobileNumber: store?.spocDetails?.[0]?.contact,
                email: store?.spocDetails?.[0]?.email,
                userName: store?.spocDetails?.[0]?.name,
              };
              userDetails = await createUser( userData );
            }
            let taskData = { ...data };
            taskData.store_id = store.storeId;
            taskData.storeName = store.storeName;
            taskData.userId = userDetails._id;
            taskData.userName = userDetails.userName;
            taskData.userEmail = userDetails.email;
            taskData.planoId = planoDetails?.planoId;
            await processedService.create( taskData );
          } ) );
        }
      }
    } ) );

    return res.sendSuccess( 'Task created successfully' );
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
    let getDetails = await processedService.find( { store_id: req.query.storeId, date_string: date, isPlano: true, checklistStatus: { $ne: 'submit' } }, { checkListName: 1, taskType: '$type' } );
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
      Key: `${req.body.taskId}/${req.body.qno}/${dayjs().format()}`,
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
    await processedService.updateOne( { _id: req.body.taskId }, { checklistStatus: req.body.status } );
    return res.sendSuccess( 'Task status updated successfully' );
  } catch ( e ) {
    logger.error( { functionName: 'storeLayout', error: e } );
    return res.sendError( e, 500 );
  }
}

export async function updateAnswers( req, res ) {
  try {
    if ( !req.body.fixtureId ) {
      return res.sendError( 'No data found', 204 );
    }

    req.body.answers.forEach( ( ans ) => {
      if ( ans.image && ans.image.includes( 'http' ) ) {
        ans.image = url.split( '.com/' )[1].split( '?' )[0];
      }
    } );

    let data = {
      fixtureId: req.body.fixtureId,
      answers: req.body.answers,
      status: req.body.answers?.find( ( ans ) => ans.answer && !ans.answer ) ? 'incomplete' : 'complete',
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
    if ( !req.query.fixtureId ) {
      return res.sendError( 'Fixture id is required', 400 );
    }
    let fixtureDetails = await planoTaskService.findOne( { fixtureId: req.query.fixtureId, type: req.query.type } );
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
      return ans;
    } ) );

    return res.sendSuccess( fixtureDetails );
  } catch ( e ) {
    logger.error( { functionName: 'getFixtureDetails', error: 'e' } );
    return res.sendError( e, 500 );
  }
}
