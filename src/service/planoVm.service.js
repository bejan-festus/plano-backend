import model from 'tango-api-schema';


export async function find( query={}, field={} ) {
  return model.planoVmModel.find( query, field );
}


export async function findOne( query={}, field={} ) {
  return model.planoVmModel.findOne( query, field );
}


export async function insertMany( data ) {
  return model.planoVmModel.insertMany( data );
}

export async function deleteMany( data ) {
  return model.planoVmModel.deleteMany( data );
}


export async function aggregate( query ) {
  return model.planoVmModel.aggregate( query );
}


export async function updateOne( query, record ) {
  return model.planoVmModel.updateOne( query, { $set: record } );
}

export async function create( data ) {
  return model.planoVmModel.create( data );
}

export async function upsertOne( query, record ) {
  return model.planoVmModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}
