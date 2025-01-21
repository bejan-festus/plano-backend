import model from 'tango-api-schema';


export async function find( query={}, field={} ) {
  return model.planoComplianceModel.find( query, field );
}


export async function findOne( query={}, field={} ) {
  return model.planoComplianceModel.findOne( query, field );
}


export async function insertMany( data ) {
  return model.planoComplianceModel.insertMany( data );
}


export async function aggregate( query ) {
  return model.planoComplianceModel.aggregate( query );
}


export async function updateOne( query, record ) {
  return model.planoComplianceModel.updateOne( query, { $set: record } );
}
