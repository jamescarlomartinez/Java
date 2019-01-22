package com.company;

import java.util.Scanner;

public class Main {

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);

        System.out.println("enter first name");
        String fname = in.next();
        System.out.println("enter last name");
        String Lname = in.next();
        System.out.println("enter phone number");
        Long number = in.nextLong();
        System.out.println("Welcome "+fname+" "+ Lname);
        System.out.println("your phone number is: "+ number);

    }
}
