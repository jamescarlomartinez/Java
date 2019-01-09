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







    }
}
