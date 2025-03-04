import model from 'tango-api-schema';

export async function create( data ) {
  return model.processedchecklistModel.create( data );
}

export async function findOne( query = {}, field = {} ) {
  return model.processedchecklistModel.findOne( query, field );
}

export async function updateOne( query = {}, record = {} ) {
  return model.processedchecklistModel.updateOne( query, { $set: record }, { upsert: true } );
}

export async function find( query = {}, field = {} ) {
  return model.processedchecklistModel.find( query, field );
}
