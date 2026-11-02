package nl.voetbalhub.app;
/** Existing personal manuscript approval is distinct from independently checked news. */
public final class AuthorColumnPolicy {
 private AuthorColumnPolicy(){}
 public static boolean approved(String type,String author,boolean explicit,String method,String hash,String approvedHash){
  return "column".equalsIgnoreCase(type)&&author!=null&&author.trim().length()>=3&&explicit&&"author_supplied_manuscript".equals(method)&&hash!=null&&hash.matches("[a-f0-9]{64}")&&hash.equals(approvedHash);
 }
}
