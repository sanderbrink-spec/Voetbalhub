package nl.voetbalhub.app;
public final class AuthorColumnPolicyTest {
 public static void main(String[] args){String hash="a".repeat(64);if(!AuthorColumnPolicy.approved("column","Sander Brink",true,"author_supplied_manuscript",hash,hash))throw new AssertionError("Approved author manuscript rejected");
  if(AuthorColumnPolicy.approved("news","Sander Brink",true,"author_supplied_manuscript",hash,hash)||AuthorColumnPolicy.approved("column","Sander Brink",false,"author_supplied_manuscript",hash,hash)||AuthorColumnPolicy.approved("column","Sander Brink",true,"author_supplied_manuscript",hash,"b".repeat(64)))throw new AssertionError("Unapproved or changed manuscript accepted");
  System.out.println("Author approval contract passed; news cannot use personal column approval.");
 }
}
