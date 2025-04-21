import model from 'tango-api-schema';


export async function find( query={}, field={} ) {
  return model.planoProductModel.find( query, field );
}


export async function findOne( query={}, field={} ) {
  return model.planoProductModel.findOne( query, field );
}


export async function insertMany( data ) {
  return model.planoProductModel.insertMany( data );
}

export async function deleteMany( data ) {
  return model.planoProductModel.deleteMany( data );
}


export async function aggregate( query ) {
  return model.planoProductModel.aggregate( query );
}


export async function updateOne( query, record ) {
  return model.planoProductModel.updateOne( query, { $set: record } );
}

export async function create( data ) {
  return model.planoProductModel.create( data );
}

export async function upsertOne( query, record ) {
  return model.planoProductModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}
