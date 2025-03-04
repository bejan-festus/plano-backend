import model from 'tango-api-schema';

export async function create( data ) {
  return model.taskProcessedModel.create( data );
}

export async function findOne( query = {}, field = {} ) {
  return model.taskProcessedModel.findOne( query, field );
}

export async function updateOne( query = {}, record = {} ) {
  return model.taskProcessedModel.updateOne( query, { $set: record }, { upsert: true } );
}

export async function find( query = {}, field = {} ) {
  return model.taskProcessedModel.find( query, field );
}
