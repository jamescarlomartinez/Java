package com.company;

public class Main {

    public static void main(String[] args) {



        //this is Letter Method
        System.out.println("this is Letter Method");
        System.out.println(Character.isLetter('7'));
        System.out.println(Character.isLetter('a'));

        System.out.println("\n");

        //this is digit Method
        System.out.println("this is Digit Method");
        System.out.println(Character.isDigit('7'));
        System.out.println(Character.isDigit('a'));

        System.out.println("\n");

        //this is Whitespace Method
        System.out.println("this is Whitespace Method");
        System.out.println(Character.isWhitespace('7'));
        System.out.println(Character.isWhitespace(' '));

        System.out.println("\n");

        //this is Uppercase Method
        System.out.println("this is Uppercase Method");
        System.out.println(Character.isUpperCase('a'));
        System.out.println(Character.isUpperCase('A'));

        System.out.println("\n");

        //this is Lowercase Method
        System.out.println("this is Lowercase Method");
        System.out.println(Character.isLowerCase('a'));
        System.out.println(Character.isLowerCase('A'));

        System.out.println("\n");

        //this is String Buffer Append
        StringBuffer sb = new StringBuffer("this is ");
        sb.append("about String Buffer Append");
        System.out.println(sb);

        System.out.println("\n");

        //this is reverse String Buffer Method
        StringBuffer sb2 = new StringBuffer("Reverse Buffer Method");
        sb2.reverse();
        System.out.println(sb2);

        System.out.println("\n");

        //this is String Buffer Delete Method
        StringBuffer sb3 = new StringBuffer("Programming");
        sb3.delete(4,7);
        System.out.println(sb3);

        System.out.println("\n");

        //this is Buffer Insert Method
        StringBuffer sb4 = new StringBuffer("Buffer  Method");
        sb4.insert(7,"Insert");
        System.out.println(sb4);

        System.out.println("\n");

        //this is String Buffer Replace Method
        StringBuffer sb5 = new StringBuffer("EWAN Buffer Replace Method");
        sb5.replace(0,4,"String");
        System.out.println(sb5);

        System.out.println("\n");

        //this is String Length Method
        String hello = "this is String Length Method";
        int note = hello.length();
        System.out.println("The Length =" + note);

        System.out.println("\n");

        //this is Concatenation Method
        String hi = "programming is the best ";
        System.out.println("java "+ hi+"computer language");

        System.out.println("\n");

        //this is Char at Method
        String eow = "Java Programming";
        char output = eow.charAt(5);
        System.out.println(output);

        System.out.println("\n");

        //this is String Concat Method
        String con = "Java Programming is ";
        con = con.concat("Interesting");
        System.out.println(con);




    }
}
