package com.company;

public class Main {

    public static void main(String[] args) {
        double a = 40.99;
        float b = 20.499f;

        System.out.println("this is ceil method");
        System.out.println(Math.ceil(a));
        System.out.println(Math.ceil(b));

        System.out.println("this is floor method");
        System.out.println(Math.floor(a));
        System.out.println(Math.floor(b));

        System.out.println("this is Rint method");
        System.out.println(Math.rint(a));
        System.out.println(Math.rint(b));

        System.out.println("this is round method");
        System.out.println(Math.round(a));
        System.out.println(Math.round(b));

        System.out.println("this is Maxmimum method");
        System.out.println(Math.max(20.499,20.5));
        System.out.println(Math.max(10.1,10.15));

        System.out.println("this is Minimum method");
        System.out.println(Math.min(20.499,20.5));
        System.out.println(Math.min(10.1,10.15));

    }
}