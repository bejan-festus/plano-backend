import model from 'tango-api-schema';

export async function create( data ) {
  return model.planoTaskCompliance.create( data );
}

export async function updateOne( query={}, record={} ) {
  return model.planoTaskCompliance.updateOne( query, { $set: record }, { upsert: true } );
}
export async function updateMany( query={}, record={} ) {
  return model.planoTaskCompliance.updateMany( query, { $set: record } );
}
export async function updateOnefilters( query={}, record={}, arrayfilter=[] ) {
  return model.planoTaskCompliance.findOneAndUpdate( query, record, { arrayFilters: arrayfilter, returnDocument: 'after' } );
}

export async function findOne( query={}, field={} ) {
  return model.planoTaskCompliance.findOne( query, field );
}

export async function find( query={}, field={} ) {
  return model.planoTaskCompliance.find( query, field );
}

export async function count( data ) {
  return model.planoTaskCompliance.countDocuments( data );
}

export async function aggregate( query ) {
  return model.planoTaskCompliance.aggregate( query );
}

export async function deleteMany( query ) {
  return model.planoTaskCompliance.deleteMany( query );
}
